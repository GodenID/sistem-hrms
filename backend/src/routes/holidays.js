import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

const BASE_COUNTRIES = ['ID', 'id']

// Ambil libur dari Nager.Date API (server-side), simpan ke tabel holidays source='api'
async function fetchApiHolidays(year) {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/ID`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Nager API ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Respons tidak valid')
    return data.map((h) => ({
      id: makeId('hol'),
      date: h.date,
      name: h.localName || h.name,
      category: 'nasional',
      isGlobal: h.global !== false,
    }))
  } catch (err) {
    console.warn('fetchApiHolidays gagal, fallback ke libur bawaan:', String(err))
    return []
  }
}

// Libur nasional statis (fallback bila API mati)
const FALLBACK_HOLIDAYS = {
  '01-01': 'Tahun Baru Masehi',
  '05-01': 'Hari Buruh Internasional',
  '06-01': 'Hari Lahir Pancasila',
  '08-17': 'Hari Kemerdekaan RI',
  '12-25': 'Hari Raya Natal',
}

async function getBaseHolidays(client, from, to) {
  const c = client?.query ? client : { query }
  const rows = await c.query(
    `SELECT * FROM holidays WHERE is_custom = FALSE AND date BETWEEN $1 AND $2 ORDER BY date ASC`,
    [from || '1900-01-01', to || '2999-12-31']
  )
  return toCamelList(rows.rows)
}

// Simpan libur API tahun tertentu ke DB kalau belum ada (hitam 1x per tahun)
async function ensureApiHolidays(client, year) {
  const c = client?.query ? client : { query }
  const existing = await c.query("SELECT COUNT(*)::int AS n FROM holidays WHERE source = 'api' AND date BETWEEN $1 AND $2", [
    `${year}-01-01`, `${year}-12-31`,
  ])
  if (existing.rows[0].n > 0) return
  const api = await fetchApiHolidays(year)
  for (const h of api) {
    await c.query(
      `INSERT INTO holidays (id, date, name, category, source, is_custom, is_global)
       VALUES ($1,$2,$3,$4,'api',FALSE,$5)
       ON CONFLICT (date, source) DO NOTHING`,
      [h.id, h.date, h.name, h.category, h.isGlobal]
    )
  }
  // Fallback: libur statis tiap tahun
  for (const [monthday, name] of Object.entries(FALLBACK_HOLIDAYS)) {
    const [mm, dd] = monthday.split('-')
    const date = `${year}-${mm}-${dd}`
    await c.query(
      `INSERT INTO holidays (id, date, name, category, source, is_custom, is_global)
       VALUES ($1,$2,$3,'nasional','fallback',FALSE,TRUE)
       ON CONFLICT (date, source) DO NOTHING`,
      [makeId('hol'), date, name]
    )
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { from, to, year, refresh } = req.query
    const y = Number(year || new Date().getFullYear())
    if (refresh === '1' || refresh === 'true') {
      await ensureApiHolidays(null, y)
    }
    const rows = await query(
      `SELECT * FROM holidays WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
      [from || `${y}-01-01`, to || `${y}-12-31`]
    )
    res.json({ holidays: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

// ---------- Custom holidays (kelolaan admin) ----------

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { date, name, category } = req.body || {}
    if (!date || !name?.trim()) return res.status(400).json({ error: 'Tanggal dan nama wajib diisi' })
    const base = await query('SELECT id FROM holidays WHERE is_custom = FALSE AND date = $1', [date])
    if (base.rows.length > 0) {
      return res.status(400).json({ error: 'Tanggal sudah ada di libur nasional' })
    }
    const existing = await query('SELECT id FROM holidays WHERE is_custom = TRUE AND date = $1', [date])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Tanggal ini sudah dibuat sebagai custom' })
    }
    const id = makeId('hol')
    const created = await query(
      `INSERT INTO holidays (id, date, name, category, source, is_custom, is_global)
       VALUES ($1,$2,$3,$4,'custom',TRUE,TRUE) RETURNING *`,
      [id, date, name.trim(), category || 'nasional']
    )
    res.status(201).json({ holiday: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, category } = req.body || {}
    const row = await query('SELECT * FROM holidays WHERE id = $1 AND is_custom = TRUE', [req.params.id])
    if (row.rows.length === 0) return res.status(404).json({ error: 'Custom holiday tidak ditemukan' })
    await query('UPDATE holidays SET name = $1, category = $2 WHERE id = $3', [
      name ?? row.rows[0].name, category ?? row.rows[0].category, req.params.id,
    ])
    const updated = await query('SELECT * FROM holidays WHERE id = $1', [req.params.id])
    res.json({ holiday: toCamel(updated.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM holidays WHERE id = $1 AND is_custom = TRUE', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
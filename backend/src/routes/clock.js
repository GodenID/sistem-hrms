import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList, tx } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { notify } from './notifications.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

// Normalisasi "HH:MM:SS WIB" / "HH:MM" → "HH:MM"
function normalizeTime(value) {
  if (!value) return null
  const m = String(value).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = String(m[1]).padStart(2, '0')
  return `${h}:${m[2]}` + (m[3] ? `:${m[3]}` : '')
}

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { userId, from, to } = req.query
    if (!userId) return res.status(400).json({ error: 'userId wajib diisi' })
    const rows = await query(
      `SELECT * FROM clock_records WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date DESC`,
      [userId, from || '1900-01-01', to || '2999-12-31']
    )
    res.json({ history: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

async function upsertClock(userId, date, field, time, client) {
  const c = client || { query }
  const existing = await c.query('SELECT id FROM clock_records WHERE user_id = $1 AND date = $2', [userId, date])
  if (existing.rows.length > 0) {
    await c.query(`UPDATE clock_records SET ${field} = $1 WHERE user_id = $2 AND date = $3`, [time, userId, date])
  } else {
    await c.query(
      `INSERT INTO clock_records (user_id, date, ${field}) VALUES ($1,$2,$3)`,
      [userId, date, time]
    )
  }
  const row = await c.query('SELECT * FROM clock_records WHERE user_id = $1 AND date = $2', [userId, date])
  return toCamel(row.rows[0])
}

router.post('/in', requireAuth, async (req, res, next) => {
  try {
    const { userId, date, time } = req.body || {}
    if (!userId || !date) return res.status(400).json({ error: 'userId dan date wajib diisi' })
    if (String(req.user.sub) !== String(userId)) {
      return res.status(403).json({ error: 'Tidak bisa clock-in atas nama orang lain' })
    }
    const record = await upsertClock(userId, date, 'clock_in', normalizeTime(time) || '00:00:00', null)
    res.status(200).json({ record })
  } catch (err) {
    next(err)
  }
})

router.post('/out', requireAuth, async (req, res, next) => {
  try {
    const { userId, date, time } = req.body || {}
    if (!userId || !date) return res.status(400).json({ error: 'userId dan date wajib diisi' })
    if (String(req.user.sub) !== String(userId)) {
      return res.status(403).json({ error: 'Tidak bisa clock-out atas nama orang lain' })
    }
    const record = await upsertClock(userId, date, 'clock_out', normalizeTime(time) || '00:00:00', null)
    res.status(200).json({ record })
  } catch (err) {
    next(err)
  }
})

// Admin: edit manual record absen
router.put('/record', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, date, clockIn, clockOut } = req.body || {}
    if (!userId || !date) return res.status(400).json({ error: 'userId dan date wajib diisi' })
    const existing = await query('SELECT id FROM clock_records WHERE user_id = $1 AND date = $2', [userId, date])
    if (existing.rows.length > 0) {
      await query('UPDATE clock_records SET clock_in = $1, clock_out = $2 WHERE user_id = $3 AND date = $4', [
        normalizeTime(clockIn), normalizeTime(clockOut), userId, date,
      ])
    } else {
      await query('INSERT INTO clock_records (user_id, date, clock_in, clock_out) VALUES ($1,$2,$3,$4)', [
        userId, date, normalizeTime(clockIn), normalizeTime(clockOut),
      ])
    }
    const row = await query('SELECT * FROM clock_records WHERE user_id = $1 AND date = $2', [userId, date])
    res.json({ record: toCamel(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

// ---------- Pending clocks (absen di luar radius) ----------

router.get('/pending', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    const rows = isAdmin
      ? await query(`SELECT p.*, u.full_name AS user_full_name FROM pending_clocks p
                     LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 100`)
      : await query(`SELECT * FROM pending_clocks WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.sub])
    res.json({ pending: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/pending', requireAuth, async (req, res, next) => {
  try {
    const { type, date, time, reason } = req.body || {}
    if (!type || !date || !time) return res.status(400).json({ error: 'type, date, dan time wajib diisi' })

    const userRow = await query('SELECT username, full_name, user_type, role FROM users WHERE id = $1', [req.user.sub])
    const user = userRow.rows[0]
    const id = makeId('vcr')
    const created = await query(
      `INSERT INTO pending_clocks (id, user_id, username, full_name, date, type, time, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, req.user.sub, user.username, user.full_name, date, normalizeTime(time), reason || null, type]
    )

    // Notifikasi ke semua admin
    const adminRows = await query("SELECT id FROM users WHERE user_type = 'admin' OR role = 'admin'")
    await notify(
      adminRows.rows.map((r) => r.id),
      'pending_clock',
      'Absen Manual Diajukan',
      `${user.full_name} mengajukan absen manual ${type === 'clockIn' ? 'masuk' : 'pulang'} (${time})`,
      id,
      'pending_clock',
      '/admin/absensi'
    )
    res.status(201).json({ pending: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.post('/pending/:id/approve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await tx(async (client) => {
      const row = await client.query('SELECT * FROM pending_clocks WHERE id = $1', [req.params.id])
      const p = row.rows[0]
      if (!p) return null
      if (p.status !== 'pending') return { error: 'Sudah direview sebelumnya' }

      await client.query(
        'UPDATE pending_clocks SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
        ['approved', req.user.sub, p.id]
      )

      const field = p.type === 'clockIn' ? 'clock_in' : 'clock_out'
      const existing = await client.query('SELECT id FROM clock_records WHERE user_id = $1 AND date = $2', [p.user_id, p.date])
      if (existing.rows.length > 0) {
        await client.query(`UPDATE clock_records SET ${field} = $1 WHERE user_id = $2 AND date = $3`, [p.time, p.user_id, p.date])
      } else {
        await client.query(`INSERT INTO clock_records (user_id, date, ${field}) VALUES ($1,$2,$3)`, [p.user_id, p.date, p.time])
      }
      return { pending: toCamel(p) }
    })

    if (!result) return res.status(404).json({ error: 'Not found' })
    if (result.error) return res.status(400).json({ error: result.error })

    await notify(
      [result.pending.userId],
      'pending_clock',
      'Absen Manual Disetujui',
      `Permintaan absen manual ${result.pending.type === 'clockIn' ? 'masuk' : 'pulang'} (${result.pending.date}) Anda disetujui admin.`,
      result.pending.id,
      'pending_clock',
      ''
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/pending/:id/reject', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM pending_clocks WHERE id = $1', [req.params.id])
    const p = row.rows[0]
    if (!p) return res.status(404).json({ error: 'Not found' })
    await query('DELETE FROM pending_clocks WHERE id = $1', [req.params.id])
    await notify(
      [p.user_id],
      'pending_clock',
      'Absen Manual Ditolak',
      `Permintaan absen manual ${p.type === 'clockIn' ? 'masuk' : 'pulang'} (${p.date}) Anda ditolak admin.`,
      p.id,
      'pending_clock',
      ''
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
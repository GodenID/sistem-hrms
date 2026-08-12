import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM locations ORDER BY created_at ASC LIMIT 10')
    res.json({ locations: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, lat, lng, radius } = req.body || {}
    if (!name?.trim() || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Nama, lat, dan lng wajib diisi' })
    }
    // Maks 4 lokasi (sama dengan perilaku frontend sebelumnya)
    const count = await query('SELECT COUNT(*)::int AS n FROM locations')
    if (count.rows[0].n >= 4) {
      return res.status(400).json({ error: 'Maksimal 4 lokasi' })
    }
    const id = makeId('loc')
    const created = await query(
      'INSERT INTO locations (id, name, lat, lng, radius) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, name.trim(), Number(lat), Number(lng), Number(radius || 100)]
    )
    res.status(201).json({ location: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, lat, lng, radius } = req.body || {}
    await query('UPDATE locations SET name = $1, lat = $2, lng = $3, radius = $4 WHERE id = $5', [
      name ?? null, lat !== undefined ? Number(lat) : null, lng !== undefined ? Number(lng) : null,
      radius !== undefined ? Number(radius) : 100, req.params.id,
    ])
    const row = await query('SELECT * FROM locations WHERE id = $1', [req.params.id])
    res.json({ location: toCamel(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM locations WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
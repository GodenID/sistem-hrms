import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notify } from './notifications.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT a.*, u.full_name AS created_by_name FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC LIMIT 200`
    )
    res.json({ announcements: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, body, type } = req.body || {}
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Judul dan isi wajib diisi' })
    }
    const userRow = await query('SELECT full_name FROM users WHERE id = $1', [req.user.sub])
    const id = makeId('ann')
    const created = await query(
      `INSERT INTO announcements (id, title, body, type, created_by, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, title.trim(), body.trim(), type || 'info', req.user.sub, userRow.rows[0]?.full_name || null]
    )

    const others = await query('SELECT id FROM users WHERE id <> $1', [req.user.sub])
    await notify(
      others.rows.map((r) => r.id),
      'announcement',
      `Pengumuman: ${title.trim()}`,
      body.trim().slice(0, 120),
      id,
      'announcement',
      '/announcements'
    )
    res.status(201).json({ announcement: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id])
    const existing = row.rows[0]
    if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' })
    // Hanya pembuat atau admin yang boleh edit
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!isAdmin && String(existing.created_by) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Hanya pembuat atau admin yang bisa mengubah' })
    }
    const { title, body, type } = req.body || {}
    await query(
      'UPDATE announcements SET title = $1, body = $2, type = $3, updated_at = NOW() WHERE id = $4',
      [title ?? existing.title, body ?? existing.body, type ?? existing.type, req.params.id]
    )
    const updated = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id])
    res.json({ announcement: toCamel(updated.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id])
    const existing = row.rows[0]
    if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' })
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!isAdmin && String(existing.created_by) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Hanya pembuat atau admin yang bisa menghapus' })
    }
    await query('DELETE FROM announcements WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
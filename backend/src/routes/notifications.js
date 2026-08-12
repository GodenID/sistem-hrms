import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

const MAX_PER_USER = 100

// Helper yang dipakai modul lain: buat notifikasi batch
export async function notify(userIds, type, title, body, refId, refType, link) {
  const ids = [...new Set(userIds.map(String))].filter(Boolean)
  if (ids.length === 0) return
  const values = []
  const params = []
  for (const userId of ids) {
    const id = makeId('ntf')
    params.push(id, userId, type, title, body || '', refId || null, refType || null, link || '')
    values.push(`($${params.length - 7},$${params.length - 6},$${params.length - 5},$${params.length - 4},$${params.length - 3},$${params.length - 2},$${params.length - 1},$${params.length})`)
  }
  await query(
    `INSERT INTO notifications (id, user_id, type, title, body, ref_id, ref_type, link) VALUES ${values.join(',')}`,
    params
  )
  // Trim notif lama per user melebihi cap
  for (const userId of ids) {
    await query(
      `DELETE FROM notifications WHERE id IN (
         SELECT id FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC OFFSET $2
       )`,
      [userId, MAX_PER_USER]
    )
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    )
    res.json({ notifications: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.put('/read-all', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.user.sub])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM notifications WHERE user_id = $1', [req.user.sub])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
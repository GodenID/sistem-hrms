import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList, tx } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notify } from './notifications.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

function computePOCategory(amount, thresholds) {
  const a = Number(amount || 0)
  if (a <= 0) return null
  if (a <= thresholds.kecilMax) return 'kecil'
  if (a <= thresholds.menengahMax) return 'menengah'
  return 'besar'
}

async function getPOThresholds(client) {
  const c = client?.query ? client : { query }
  const row = await c.query("SELECT value FROM settings WHERE key = 'po_thresholds'")
  return row.rows[0]?.value || { kecilMax: 50000000, menengahMax: 200000000 }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM events ORDER BY created_at DESC LIMIT 500')
    const thresholds = await getPOThresholds(null)
    const events = toCamelList(rows.rows).map((e) => ({
      ...e,
      poCategory: e.poCategory || computePOCategory(e.poAmount, thresholds),
    }))
    res.json({ events })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, startDate, endDate, location, status, poAmount, manpower, additionalCosts } = req.body || {}
    if (!name?.trim() || !startDate) {
      return res.status(400).json({ error: 'Nama event dan tanggal mulai wajib diisi' })
    }
    const thresholds = await getPOThresholds(null)
    const s = status === 'pending' ? 'pending' : 'approved'
    const id = makeId('evt')
    const created = await query(
      `INSERT INTO events (id, name, start_date, end_date, location, created_by, status, po_amount, po_category, manpower, additional_costs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        id, name.trim(), startDate, endDate || startDate, location || null, req.user.sub, s,
        Number(poAmount || 0), computePOCategory(poAmount, thresholds) || 'kecil',
        JSON.stringify(manpower || []), JSON.stringify(additionalCosts || []),
      ]
    )

    const others = await query('SELECT id, user_type, role FROM users WHERE id <> $1', [req.user.sub])
    const targetIds = s === 'pending'
      ? others.rows.filter((u) => u.user_type === 'admin' || u.role === 'admin').map((r) => r.id)
      : others.rows.map((r) => r.id)
    await notify(
      targetIds,
      'event',
      `Event Baru: ${name.trim()}`,
      `${startDate}${endDate && endDate !== startDate ? ' – ' + endDate : ''}${location ? ' · ' + location : ''}`,
      id,
      'event',
      '/events'
    )
    res.status(201).json({ event: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM events WHERE id = $1', [req.params.id])
    const existing = row.rows[0]
    if (!existing) return res.status(404).json({ error: 'Event tidak ditemukan' })

    const prevStatus = existing.status
    const {
      name, startDate, endDate, location, status, poAmount, poCategory, manpower, additionalCosts, reviewedByName,
    } = req.body || {}

    const thresholds = await getPOThresholds(null)
    const poAmt = poAmount !== undefined ? Number(poAmount) : existing.po_amount
    const cat = poCategory || computePOCategory(poAmt, thresholds) || existing.po_category

    await query(
      `UPDATE events SET name = $1, start_date = $2, end_date = $3, location = $4, status = $5,
       po_amount = $6, po_category = $7, manpower = $8, additional_costs = $9,
       reviewed_by_name = $10, updated_at = NOW() WHERE id = $11`,
      [
        name ?? existing.name, startDate ?? existing.start_date, endDate ?? existing.end_date,
        location ?? existing.location, status ?? existing.status, poAmt, cat,
        JSON.stringify(manpower ?? existing.manpower), JSON.stringify(additionalCosts ?? existing.additionalCosts),
        reviewedByName ?? existing.reviewed_by_name, req.params.id,
      ]
    )

    const newStatus = status ?? existing.status
    if (existing.created_by && prevStatus !== newStatus) {
      const isPending = newStatus === 'pending'
      const isApproved = newStatus === 'approved'
      const isRejected = newStatus === 'rejected'
      if (!isPending) {
        const label = isApproved ? 'disetujui' : isRejected ? 'ditolak' : newStatus
        await notify(
          [existing.created_by],
          'event',
          `Event ${label}: ${existing.name}`,
          `Status event Anda "${existing.name}" sekarang ${label} oleh admin.`,
          existing.id,
          'event',
          `/events/${existing.id}`
        )
      }
    }

    const updated = await query('SELECT * FROM events WHERE id = $1', [req.params.id])
    res.json({ event: { ...toCamel(updated.rows[0]), poCategory: cat } })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT id FROM events WHERE id = $1', [req.params.id])
    if (row.rows.length === 0) return res.status(404).json({ error: 'Event tidak ditemukan' })
    await tx(async (client) => {
      await client.query('DELETE FROM vouchers WHERE event_id = $1', [req.params.id])
      await client.query('DELETE FROM events WHERE id = $1', [req.params.id])
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------- Vouchers ----------

router.get('/:eventId/vouchers', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM vouchers WHERE event_id = $1 ORDER BY created_at ASC', [req.params.eventId])
    res.json({ vouchers: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/:eventId/vouchers', requireAuth, async (req, res, next) => {
  try {
    const { name, roles } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Nama voucher wajib diisi' })
    const id = makeId('vcr')
    const created = await query(
      'INSERT INTO vouchers (id, event_id, name, roles) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, req.params.eventId, name.trim(), JSON.stringify(roles || [])]
    )
    res.status(201).json({ voucher: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:eventId/vouchers/:voucherId', requireAuth, async (req, res, next) => {
  try {
    const { name, roles } = req.body || {}
    await query('UPDATE vouchers SET name = $1, roles = $2 WHERE id = $3 AND event_id = $4', [
      name, JSON.stringify(roles || []), req.params.voucherId, req.params.eventId,
    ])
    const row = await query('SELECT * FROM vouchers WHERE id = $1', [req.params.voucherId])
    res.json({ voucher: toCamel(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:eventId/vouchers/:voucherId', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM vouchers WHERE id = $1 AND event_id = $2', [req.params.voucherId, req.params.eventId])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------- PO thresholds ----------

router.get('/po-thresholds', requireAuth, async (req, res, next) => {
  try {
    const t = await getPOThresholds(null)
    res.json({ thresholds: t })
  } catch (err) {
    next(err)
  }
})

router.put('/po-thresholds', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!isAdmin) return res.status(403).json({ error: 'Akses ditolak' })
    const { kecilMax, menengahMax } = req.body || {}
    await query(
      `INSERT INTO settings (key, value) VALUES ('po_thresholds', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ kecilMax: Number(kecilMax), menengahMax: Number(menengahMax) })]
    )
    const row = await query("SELECT value FROM settings WHERE key = 'po_thresholds'")
    res.json({ thresholds: row.rows[0].value })
  } catch (err) {
    next(err)
  }
})

export default router
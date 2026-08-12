import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList, tx } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { notify } from './notifications.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

function normalizeTime(value) {
  if (!value) return null
  const m = String(value).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = String(m[1]).padStart(2, '0')
  return `${h}:${m[2]}` + (m[3] ? `:${m[3]}` : '')
}

function countDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    const rows = isAdmin
      ? await query('SELECT * FROM pengajuan ORDER BY created_at DESC LIMIT 500')
      : await query('SELECT * FROM pengajuan WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub])
    res.json({ pengajuan: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, startDate, endDate, reason, clockInTime, clockOutTime } = req.body || {}
    if (!type || !startDate || !endDate || !reason?.trim()) {
      return res.status(400).json({ error: 'Semua field wajib diisi.' })
    }
    if ((type === 'koreksi' || type === 'lembur') && (!clockInTime || !clockOutTime)) {
      return res.status(400).json({ error: 'Jam masuk dan pulang wajib diisi.' })
    }

    const userRow = await query('SELECT username, full_name FROM users WHERE id = $1', [req.user.sub])
    const user = userRow.rows[0]
    const id = makeId('png')
    const created = await query(
      `INSERT INTO pengajuan (id, user_id, username, full_name, type, start_date, end_date, reason, clock_in_time, clock_out_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        id, req.user.sub, user.username, user.full_name, type, startDate, endDate,
        reason.trim(), (type === 'koreksi' || type === 'lembur') ? normalizeTime(clockInTime) : null,
        (type === 'koreksi' || type === 'lembur') ? normalizeTime(clockOutTime) : null,
      ]
    )

    const adminRows = await query("SELECT id FROM users WHERE user_type = 'admin' OR role = 'admin'")
    const typeLabel = { cuti: 'Cuti', sakit: 'Sakit', lembur: 'Lembur', koreksi: 'Koreksi Absen', lainnya: 'Lainnya' }[type]
    await notify(
      adminRows.rows.map((r) => r.id),
      'pengajuan',
      'Pengajuan Baru',
      `${user.full_name} mengajukan ${typeLabel} (${startDate}${endDate !== startDate ? ' – ' + endDate : ''})`,
      id,
      'pengajuan',
      '/admin/pengajuan'
    )

    res.status(201).json({ item: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body || {}
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid.' })
    }

    const result = await tx(async (client) => {
      const row = await client.query('SELECT * FROM pengajuan WHERE id = $1', [req.params.id])
      const prev = row.rows[0]
      if (!prev) return null

      const reviewer = await client.query('SELECT username, full_name FROM users WHERE id = $1', [req.user.sub])

      await client.query(
        `UPDATE pengajuan SET status = $1, reviewed_by = $2, reviewed_by_name = $3, reviewed_at = NOW(),
         rejection_reason = $4 WHERE id = $5`,
        [status, req.user.sub, reviewer.rows[0]?.full_name || null, status === 'rejected' ? (rejectionReason || null) : null, prev.id]
      )

      // Auto deduct / add-back cuti
      if (prev.type === 'cuti') {
        const year = new Date(prev.start_date + 'T00:00:00').getFullYear()
        const days = countDays(prev.start_date, prev.end_date)
        const wasApproved = prev.status === 'approved'
        const isApproved = status === 'approved'
        const delta = (!wasApproved && isApproved) ? days : (wasApproved && !isApproved) ? -days : 0
        if (delta !== 0) {
          await client.query(
            `INSERT INTO leave_balances (user_id, year, total_quota, used)
             VALUES ($1,$2,12, GREATEST(0,$3))
             ON CONFLICT (user_id, year)
             DO UPDATE SET used = GREATEST(0, leave_balances.used + EXCLUDED.used)`,
            [prev.user_id, year, delta]
          )
        }
      }
      return { prev, status }
    })

    if (!result) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })

    const statusLabel = { approved: 'disetujui', rejected: 'ditolak', pending: 'pending' }[result.status]
    await notify(
      [result.prev.user_id],
      'pengajuan',
      `Pengajuan ${statusLabel}`,
      `Pengajuan ${result.prev.type} (${result.prev.start_date}) Anda ${statusLabel} oleh admin.`,
      result.prev.id,
      'pengajuan',
      `/pengajuan/${result.prev.id}`
    )

    const updated = await query('SELECT * FROM pengajuan WHERE id = $1', [req.params.id])
    res.json({ item: toCamel(updated.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    const row = await query('SELECT * FROM pengajuan WHERE id = $1', [req.params.id])
    const p = row.rows[0]
    if (!p) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })
    if (!isAdmin && String(p.user_id) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Tidak bisa menghapus pengajuan orang lain' })
    }
    // Kembalikan saldo cuti jika pengajuan cuti yang sudah approved dihapus
    if (p.type === 'cuti' && p.status === 'approved') {
      const year = new Date(p.start_date + 'T00:00:00').getFullYear()
      const days = countDays(p.start_date, p.end_date)
      await query(
        `INSERT INTO leave_balances (user_id, year, total_quota, used)
         VALUES ($1,$2,12, GREATEST(0,$3))
         ON CONFLICT (user_id, year)
         DO UPDATE SET used = GREATEST(0, leave_balances.used - $3)`,
        [p.user_id, year, days]
      )
    }
    await query('DELETE FROM pengajuan WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
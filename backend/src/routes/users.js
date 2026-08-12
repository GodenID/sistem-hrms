import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList, tx } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { publicUser } from './auth.js'
import { notify } from './notifications.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

const PUBLIC_FIELDS =
  'id, username, full_name, role, user_type, ktp, nik, division, birth_place, birth_date, sex, address, ktp_verified, avatar_color, suspended, created_at'

// ---------- Admin: kelola user ----------

// Daftar user (boleh diakses semua user yang login untuk keperluan directory/notifikasi)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at ASC`)
    res.json({ users: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { username, password, fullName, role, ktp, nik, division, birthPlace, birthDate, sex, address } =
      req.body || {}
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, dan nama lengkap wajib diisi' })
    }
    const existing = await query('SELECT id FROM users WHERE username = $1', [username])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username sudah terdaftar' })
    }
    const id = makeId('usr')
    const hash = await bcrypt.hash(password, 10)
    const userType = role === 'admin' ? 'admin' : 'karyawan'
    await query(
      `INSERT INTO users (id, username, password, full_name, role, user_type, ktp, nik, division, birth_place, birth_date, sex, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, username, hash, fullName, role || 'employee', userType, ktp || null, nik || null, division || null, birthPlace || null, birthDate || null, sex || null, address || null]
    )
    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id])
    res.status(201).json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { fullName, ktp, nik, division, birthPlace, birthDate, sex, address } = req.body || {}
    await query(
      `UPDATE users SET full_name = COALESCE($1, full_name), ktp = COALESCE($2, ktp),
       nik = COALESCE($3, nik), division = COALESCE($4, division), birth_place = COALESCE($5, birth_place),
       birth_date = COALESCE($6, birth_date), sex = COALESCE($7, sex), address = COALESCE($8, address)
       WHERE id = $9`,
      [fullName, ktp, nik, division, birthPlace, birthDate, sex, address, req.params.id]
    )
    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.params.id])
    res.json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body || {}
    if (!role || !['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }
    await query('UPDATE users SET role = $1, user_type = $2 WHERE id = $3', [role, role === 'admin' ? 'admin' : 'karyawan', req.params.id])
    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.params.id])
    res.json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

// ---------- Saldo cuti ----------

// Semua saldo (admin: semua user; non-admin: dirinya sendiri)
router.get('/leave/balances', requireAuth, async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear())
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    const rows = isAdmin
      ? await query(
          `SELECT id, user_id, year, total_quota, used FROM leave_balances WHERE year = $1`,
          [year]
        )
      : await query(
          `SELECT id, user_id, year, total_quota, used FROM leave_balances WHERE user_id = $1 AND year = $2`,
          [req.user.sub, year]
        )
    res.json({
      balances: toCamelList(rows.rows).map((b) => ({
        ...b,
        remaining: Math.max(0, b.totalQuota - b.used),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/leave/balance/:userId/:year', requireAuth, async (req, res, next) => {
  try {
    const { userId, year } = req.params
    const y = Number(year)
    const row = await query(
      `SELECT id, user_id, year, total_quota, used FROM leave_balances WHERE user_id = $1 AND year = $2`,
      [userId, y]
    )
    if (row.rows.length === 0) {
      return res.json({ balance: { userId, year: y, totalQuota: 12, used: 0, remaining: 12 } })
    }
    const b = toCamel(row.rows[0])
    res.json({ balance: { ...b, remaining: Math.max(0, b.totalQuota - b.used) } })
  } catch (err) {
    next(err)
  }
})

router.put('/leave/balance', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, year, totalQuota, used } = req.body || {}
    if (!userId || !year) return res.status(400).json({ error: 'userId dan year wajib diisi' })
    await query(
      `INSERT INTO leave_balances (user_id, year, total_quota, used)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, year)
       DO UPDATE SET total_quota = EXCLUDED.total_quota, used = EXCLUDED.used`,
      [userId, Number(year), Number(totalQuota ?? 12), Number(used ?? 0)]
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Tambah pemakaian cuti (+days) atau kembalikan (-days). Dipanggil saat pengajuan cuti di-approve/dibatalkan.
router.post('/leave/deduct', requireAuth, async (req, res, next) => {
  try {
    const { userId, year, days } = req.body || {}
    if (!userId || !year || !days) return res.status(400).json({ error: 'userId, year, days wajib diisi' })
    const d = Number(days)
    const y = Number(year)
    await query(
      `INSERT INTO leave_balances (user_id, year, total_quota, used)
       VALUES ($1,$2,12, GREATEST(0, $3))
       ON CONFLICT (user_id, year)
       DO UPDATE SET used = GREATEST(0, leave_balances.used + EXCLUDED.used)`,
      [userId, y, d]
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Penyesuaian kuota massal admin + audit trail
router.post('/leave/adjust', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, year, startDate, endDate, days, reason } = req.body || {}
    if (!userId || !year) return res.status(400).json({ error: 'userId dan year wajib diisi' })
    const id = makeId('adj')
    const d = Number(days ?? 0)
    await tx(async (client) => {
      await client.query(
        `INSERT INTO leave_balances (user_id, year, total_quota, used)
         VALUES ($1,$2,12, GREATEST(0,$3))
         ON CONFLICT (user_id, year)
         DO UPDATE SET used = GREATEST(0, leave_balances.used + $3)`,
        [userId, Number(year), d]
      )
      await client.query(
        `INSERT INTO leave_adjustments (id, user_id, year, start_date, end_date, days, reason, adjusted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, userId, Number(year), startDate || null, endDate || null, d, reason || null, req.user.sub]
      )
    })
    const bal = await query('SELECT * FROM leave_balances WHERE user_id = $1 AND year = $2', [userId, Number(year)])
    const b = bal.rows[0]
    if (b) {
      const totalQuota = b.total_quota ?? 12
      const remaining = Math.max(0, (b.total_quota ?? 12) - b.used)
      const fmt = (s) => {
        if (!s) return ''
        const [y, m, dd] = String(s).slice(0, 10).split('-')
        return `${dd}-${m}-${y}`
      }
      const dateRange = startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`
      await notify(
        [userId],
        'leave_adjustment',
        'Cuti Bersama',
        `Saldo cuti Anda terpakai ${d} hari (${dateRange}) untuk "${reason || ''}". Sisa saldo: ${remaining}/${totalQuota} hari.`,
        id,
        'leave_adjustment',
        '/settings'
      )
    }
    res.status(201).json({ ok: true, id })
  } catch (err) {
    next(err)
  }
})

router.get('/leave/adjustments/:userId', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT a.*, u.full_name AS adjusted_by_name
       FROM leave_adjustments a LEFT JOIN users u ON u.id = a.adjusted_by
       WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
      [req.params.userId]
    )
    res.json({ adjustments: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

export default router

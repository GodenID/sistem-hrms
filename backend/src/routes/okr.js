import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { query, toCamel, toCamelList, tx } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

// ---------- Users OKR (dengan jobs) ----------

async function fetchUsersWithJobs(client) {
  const c = client?.query ? client : { query }
  const userRows = await c.query(
    `SELECT id, username, full_name, role, user_type, suspended, ktp_verified, avatar_color FROM users ORDER BY created_at ASC`
  )
  const jobRows = await c.query('SELECT * FROM user_jobs ORDER BY position ASC')
  const jobsByUser = {}
  for (const j of jobRows.rows) {
    if (!jobsByUser[j.user_id]) jobsByUser[j.user_id] = []
    jobsByUser[j.user_id].push(toCamel(j))
  }
  return userRows.rows.map((u) => ({
    ...toCamel(u),
    password: '',
    jobs: jobsByUser[u.id] || [],
  }))
}

router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const users = await fetchUsersWithJobs(null)
    res.json({ users })
  } catch (err) {
    next(err)
  }
})

router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { username, password, fullName, role, userType } = req.body || {}
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, dan fullName wajib diisi' })
    }
    const existing = await query('SELECT id FROM users WHERE username = $1', [username])
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username sudah terdaftar' })

    const id = makeId('usr')
    const hash = await bcrypt.hash(password, 10)
    const r = role || 'employee'
    const ut = userType || (r === 'admin' ? 'admin' : 'karyawan')
    await query(
      `INSERT INTO users (id, username, password, full_name, role, user_type) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, username, hash, fullName, r, ut]
    )
    const users = await fetchUsersWithJobs(null)
    res.status(201).json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

router.put('/users/:username', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { fullName, role, userType, password } = req.body || {}
    const row = await query('SELECT id FROM users WHERE username = $1', [req.params.username])
    if (row.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' })
    const id = row.rows[0].id
    const updates = []
    const params = []
    if (fullName) { params.push(fullName); updates.push(`full_name = $${params.length}`) }
    if (role) { params.push(role); updates.push(`role = $${params.length}`) }
    if (userType) { params.push(userType); updates.push(`user_type = $${params.length}`) }
    if (updates.length > 0) {
      params.push(id)
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params)
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await query('UPDATE users SET password = $1 WHERE id = $2', [hash, id])
    }
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

router.patch('/users/:username/suspend', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query('UPDATE users SET suspended = TRUE WHERE username = $1', [req.params.username])
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

router.patch('/users/:username/activate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query('UPDATE users SET suspended = FALSE WHERE username = $1', [req.params.username])
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

// Hapus user + cascade okr_inputs + user_jobs (FK ON DELETE CASCADE)
router.delete('/users/:username', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const row = await query('SELECT id, user_type FROM users WHERE username = $1', [req.params.username])
    if (row.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' })
    const id = row.rows[0].id
    await tx(async (client) => {
      await client.query('DELETE FROM users WHERE id = $1', [id])
    })
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

// ---------- Jobs ----------

router.post('/users/:username/jobs', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { label, type, dailyTarget, monthlyTargetIDR, clientType } = req.body || {}
    const userRow = await query('SELECT id FROM users WHERE username = $1', [req.params.username])
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' })
    const userId = userRow.rows[0].id

    const countRow = await query('SELECT COUNT(*)::int AS n FROM user_jobs WHERE user_id = $1', [userId])
    if (countRow.rows[0].n >= 3) return res.status(400).json({ error: 'Maksimal 3 job per user' })

    const posRow = await query('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM user_jobs WHERE user_id = $1', [userId])
    const id = makeId('job')
    await query(
      `INSERT INTO user_jobs (id, user_id, label, type, daily_target, monthly_target_idr, client_type, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, userId, label, type || 'standard', dailyTarget || null, monthlyTargetIDR || null, clientType || null, posRow.rows[0].pos]
    )
    const users = await fetchUsersWithJobs(null)
    res.status(201).json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

router.put('/users/:username/jobs/:jobId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { label, type, dailyTarget, monthlyTargetIDR, clientType } = req.body || {}
    const userRow = await query('SELECT id FROM users WHERE username = $1', [req.params.username])
    const userId = userRow.rows[0]?.id
    await query(
      `UPDATE user_jobs SET label = $1, type = $2, daily_target = $3, monthly_target_idr = $4, client_type = $5
       WHERE id = $6 AND user_id = $7`,
      [label ?? null, type ?? null, dailyTarget ?? null, monthlyTargetIDR ?? null, clientType ?? null, req.params.jobId, userId]
    )
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

router.delete('/users/:username/jobs/:jobId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query('DELETE FROM user_jobs WHERE id = $1', [req.params.jobId])
    const users = await fetchUsersWithJobs(null)
    res.json({ ok: true, users })
  } catch (err) {
    next(err)
  }
})

// ---------- Inputs harian ----------

router.get('/inputs', requireAuth, async (req, res, next) => {
  try {
    const { username, userId, date, from, to } = req.query
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'

    let targetId = userId || null
    if (username && !targetId) {
      const row = await query('SELECT id FROM users WHERE username = $1', [username])
      targetId = row.rows[0]?.id || null
    }
    if (!targetId) {
      return res.status(400).json({ error: 'userId atau username wajib diisi' })
    }
    if (!isAdmin && String(targetId) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }

    const conditions = ['user_id = $1']
    const params = [targetId]
    if (date) {
      params.push(date)
      conditions.push(`work_date = $${params.length}`)
    } else {
      params.push(from || '1900-01-01', to || '2999-12-31')
      conditions.push(`work_date BETWEEN $${params.length - 1} AND $${params.length}`)
    }

    const rows = await query(
      `SELECT * FROM okr_inputs WHERE ${conditions.join(' AND ')} ORDER BY work_date DESC, timestamp DESC`,
      params
    )
    res.json({ inputs: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

router.get('/inputs/dates', requireAuth, async (req, res, next) => {
  try {
    const { username, userId } = req.query
    let targetId = userId || null
    if (username && !targetId) {
      const row = await query('SELECT id FROM users WHERE username = $1', [username])
      targetId = row.rows[0]?.id || null
    }
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!targetId) {
      targetId = req.user.sub
    }
    if (!isAdmin && String(targetId) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }
    const rows = await query(
      'SELECT DISTINCT work_date FROM okr_inputs WHERE user_id = $1 ORDER BY work_date DESC',
      [targetId]
    )
    res.json({ dates: rows.rows.map((r) => r.work_date.toISOString().slice(0, 10)) })
  } catch (err) {
    next(err)
  }
})

// Semua tanggal input semua karyawan (untuk admin)
router.get('/inputs/all-dates', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT i.user_id, u.username, i.work_date FROM okr_inputs i
       JOIN users u ON u.id = i.user_id GROUP BY i.user_id, u.username, i.work_date
       ORDER BY i.work_date DESC`
    )
    const map = {}
    for (const r of rows.rows) {
      const date = r.work_date.toISOString().slice(0, 10)
      if (!map[r.username]) map[r.username] = []
      map[r.username].push(date)
    }
    res.json({ datesByUser: map })
  } catch (err) {
    next(err)
  }
})

router.post('/inputs', requireAuth, async (req, res, next) => {
  try {
    const { username, workDate, title, description, jobId, jobLabel, nominalIDR, customerKind } = req.body || {}
    if (!username || !workDate || !title?.trim()) {
      return res.status(400).json({ error: 'username, workDate, dan title wajib diisi' })
    }
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    const userRow = await query('SELECT id FROM users WHERE username = $1', [username])
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' })
    const userId = userRow.rows[0].id
    if (!isAdmin && String(userId) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }

    const id = makeId('okr')
    const created = await query(
      `INSERT INTO okr_inputs (id, user_id, work_date, title, description, job_id, job_label, nominal_idr, customer_kind)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, userId, workDate, title.trim(), description || '', jobId || null, jobLabel || null,
       nominalIDR != null ? Number(nominalIDR) : null, customerKind || null]
    )
    res.status(201).json({ item: toCamel(created.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.put('/inputs/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM okr_inputs WHERE id = $1', [req.params.id])
    const existing = row.rows[0]
    if (!existing) return res.status(404).json({ error: 'Item tidak ditemukan' })
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!isAdmin && String(existing.user_id) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }
    const { title, description, jobId, jobLabel, nominalIDR, customerKind } = req.body || {}
    await query(
      `UPDATE okr_inputs SET title = $1, description = $2, job_id = $3, job_label = $4,
       nominal_idr = $5, customer_kind = $6 WHERE id = $7`,
      [title ?? existing.title, description ?? existing.description, jobId ?? null, jobLabel ?? null,
       nominalIDR != null ? Number(nominalIDR) : null, customerKind ?? null, req.params.id]
    )
    const updated = await query('SELECT * FROM okr_inputs WHERE id = $1', [req.params.id])
    res.json({ item: toCamel(updated.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.delete('/inputs/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await query('SELECT * FROM okr_inputs WHERE id = $1', [req.params.id])
    const existing = row.rows[0]
    if (!existing) return res.status(404).json({ error: 'Item tidak ditemukan' })
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin'
    if (!isAdmin && String(existing.user_id) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }
    await query('DELETE FROM okr_inputs WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Ambil input semua user untuk rentang tanggal (dipakai halaman Team/Monitoring)
router.get('/team', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const rows = await query(
      `SELECT i.*, u.username, u.full_name, u.user_type, u.suspended, u.avatar_color
       FROM okr_inputs i JOIN users u ON u.id = i.user_id
       WHERE i.work_date BETWEEN $1 AND $2 ORDER BY i.work_date ASC, u.full_name ASC`,
      [from || '1900-01-01', to || '2999-12-31']
    )
    res.json({ inputs: toCamelList(rows.rows) })
  } catch (err) {
    next(err)
  }
})

export default router
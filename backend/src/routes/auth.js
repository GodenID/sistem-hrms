import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { query, toCamel, tx } from '../db.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = Router()

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
}

const PUBLIC_FIELDS =
  'id, username, full_name, role, user_type, ktp, nik, division, birth_place, birth_date, sex, address, ktp_verified, avatar_color, suspended, created_at'

export function publicUser(row) {
  if (!row) return null
  const u = toCamel(row)
  delete u.password
  return u
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, fullName, ktp, nik, division, birthPlace, birthDate, sex, address } =
      req.body || {}

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, dan nama lengkap wajib diisi' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' })
    }

    const existing = await query('SELECT id FROM users WHERE username = $1', [username])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username sudah terdaftar' })
    }

    const id = makeId('usr')
    const hash = await bcrypt.hash(password, 10)
    await query(
      `INSERT INTO users (id, username, password, full_name, ktp, nik, division, birth_place, birth_date, sex, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, username, hash, fullName, ktp || null, nik || null, division || null, birthPlace || null, birthDate || null, sex || null, address || null]
    )

    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id])
    res.status(201).json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' })
    }

    const row = await query('SELECT * FROM users WHERE username = $1', [username])
    const user = row.rows[0]
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' })
    }
    if (user.suspended) {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan, hubungi admin' })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return res.status(401).json({ error: 'Username atau password salah' })
    }

    const token = signToken(user)
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.user.sub])
    if (row.rows.length === 0) {
      return res.status(401).json({ error: 'User tidak ditemukan' })
    }
    res.json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

// Cek apakah username terdaftar (untuk reset password flow)
router.post('/verify-username', async (req, res, next) => {
  try {
    const { username } = req.body || {}
    const row = await query(
      'SELECT id, username, full_name FROM users WHERE username = $1 AND suspended = FALSE',
      [username]
    )
    const u = row.rows[0]
    if (!u) {
      return res.status(404).json({ error: 'Username tidak ditemukan' })
    }
    res.json({ found: true, username: u.username, fullName: u.full_name })
  } catch (err) {
    next(err)
  }
})

// Ganti password user lain (admin reset)
router.post('/reset-password', requireAuth, async (req, res, next) => {
  try {
    const { username, newPassword } = req.body || {}
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' })
    }
    const target = await query('SELECT id, user_type FROM users WHERE username = $1', [username])
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Username tidak ditemukan' })
    }
    if (target.rows[0].user_type === 'admin') {
      return res.status(403).json({ error: 'Password admin tidak bisa di-reset lewat sini' })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE users SET password = $1 WHERE id = $2', [hash, target.rows[0].id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Ganti password sendiri
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {}
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' })
    }
    const row = await query('SELECT password FROM users WHERE id = $1', [req.user.sub])
    const ok = await bcrypt.compare(oldPassword || '', row.rows[0]?.password || '')
    if (!ok) {
      return res.status(400).json({ error: 'Password lama salah' })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.sub])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Update profil sendiri
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { fullName, ktp, nik, division, birthPlace, birthDate, sex, address } = req.body || {}
    await query(
      `UPDATE users SET full_name = COALESCE($1, full_name), ktp = COALESCE($2, ktp),
       nik = COALESCE($3, nik), division = COALESCE($4, division), birth_place = COALESCE($5, birth_place),
       birth_date = COALESCE($6, birth_date), sex = COALESCE($7, sex), address = COALESCE($8, address)
       WHERE id = $9`,
      [fullName, ktp, nik, division, birthPlace, birthDate, sex, address, req.user.sub]
    )
    const row = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.user.sub])
    res.json({ user: publicUser(row.rows[0]) })
  } catch (err) {
    next(err)
  }
})

export default router

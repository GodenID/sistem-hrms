import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, userType: user.user_type },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Tidak terautentikasi' })
  }
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.userType !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: butuh role admin' })
  }
  next()
}

export { signToken }

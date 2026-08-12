import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { config, assertProductionConfig } from './config/index.js'
import { pool, query } from './db.js'
import { logger } from './utils/logger.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import clockRoutes from './routes/clock.js'
import pengajuanRoutes from './routes/pengajuan.js'
import announcementRoutes from './routes/announcements.js'
import eventRoutes from './routes/events.js'
import notificationRoutes from './routes/notifications.js'
import locationRoutes from './routes/locations.js'
import holidayRoutes from './routes/holidays.js'
import okrRoutes from './routes/okr.js'

// Seed admin awal bila tabel users kosong
async function seedAdmin() {
  const row = await query('SELECT COUNT(*)::int AS n FROM users')
  if (row.rows[0].n > 0) return

  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const hash = await bcrypt.hash(password, 10)
  await query(
    `INSERT INTO users (id, username, password, full_name, role, user_type, ktp_verified)
     VALUES ('usr_admin_seed', $1, $2, 'Administrator', 'admin', 'admin', TRUE)`,
    [username, hash]
  )
  logger.info('Admin awal dibuat', { username })
}

async function main() {
  assertProductionConfig()
  await seedAdmin()

  const app = express()
  app.set('trust proxy', 1)
  app.use(cors({ origin: config.cors.origin.includes('*') ? true : config.cors.origin }))
  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: config.env, time: new Date().toISOString() })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/clock', clockRoutes)
  app.use('/api/pengajuan', pengajuanRoutes)
  app.use('/api/announcements', announcementRoutes)
  app.use('/api/events', eventRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/locations', locationRoutes)
  app.use('/api/holidays', holidayRoutes)
  app.use('/api/okr', okrRoutes)

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' })
  })

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', { err: String(err?.stack || err) })
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  })

  app.listen(config.port, () => {
    logger.info(`HRMS API berjalan di port ${config.port} (${config.env})`)
  })
}

main().catch((err) => {
  logger.error('Gagal start server', { err: String(err) })
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end()
  process.exit(0)
})
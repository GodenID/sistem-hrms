import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function bool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).toLowerCase() === 'true'
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),

  didit: {
    // Per-destination secret from Didit Business Console
    webhookSecret: process.env.DIDIT_WEBHOOK_SECRET || '',
    // Dev-only escape hatch. NEVER true in production.
    skipSignatureVerify: bool(process.env.DIDIT_SKIP_SIGNATURE_VERIFY, false),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  db: {
    connectionString: process.env.DATABASE_URL || '',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    debugBodyLogPath: process.env.DEBUG_BODY_LOG_PATH || '',
  },
}

// Lazily validate required secrets at boot, not at import time
export function assertProductionConfig() {
  if (config.env === 'production') {
    if (!config.didit.webhookSecret) {
      required('DIDIT_WEBHOOK_SECRET')
    }
    if (config.didit.skipSignatureVerify) {
      throw new Error('DIDIT_SKIP_SIGNATURE_VERIFY must be false in production')
    }
    if (!config.auth.jwtSecret) {
      required('JWT_SECRET')
    }
    if (!config.db.connectionString) {
      required('DATABASE_URL')
    }
  }
}

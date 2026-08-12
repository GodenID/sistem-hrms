import pg from 'pg'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'

if (!config.db.connectionString) {
  throw new Error('DATABASE_URL belum di-set. Lihat backend/.env.example')
}

export const pool = new pg.Pool({
  connectionString: config.db.connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  logger.error('PG pool error', { err: String(err) })
})

export async function query(text, params) {
  const res = await pool.query(text, params)
  return res
}

export async function tx(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Snake_case (DB) <-> camelCase (frontend) converters
export function toCamel(row) {
  if (!row || typeof row !== 'object') return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return out
}

export function toCamelList(rows) {
  return rows.map(toCamel)
}

export function toSnake(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())] = v
  }
  return out
}

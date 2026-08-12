import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL tidak di-set. Salin backend/.env.example ke backend/.env dan isi.')
  }

  const pool = new pg.Pool({ connectionString })
  try {
    const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8')
    await pool.query(schema)
    console.log('✓ Skema database berhasil dibuat/diperbarui')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Migrasi gagal:', err.message)
  process.exit(1)
})

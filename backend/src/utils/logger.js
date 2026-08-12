// Minimal structured logger. Avoids extra dependencies.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

function shouldLog(level) {
  const min = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 2
  return LEVELS[level] <= min
}

function emit(level, msg, meta) {
  if (!shouldLog(level)) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  }
  // Write to stdout for info/debug, stderr for warn/error so container
  // log drivers can route them correctly.
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  stream.write(JSON.stringify(entry) + '\n')
}

export const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
}

// Append a raw webhook body to disk for debugging signature failures.
// Returns nothing — fire and forget.
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function debugLogBody(logPath, entry) {
  if (!logPath) return
  try {
    await mkdir(dirname(logPath), { recursive: true })
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8')
  } catch (err) {
    logger.warn('debugLogBody failed', { err: String(err) })
  }
}

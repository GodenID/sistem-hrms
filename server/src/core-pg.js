// ============================================================
// core-pg — pengganti functions/lib/core.js untuk server Node.
//
// Mengekspor NAMA YANG SAMA PERSIS dengan core.js sehingga modul
// hasil sync (server/src/gen/*.js) tidak perlu diubah logikanya.
// Yang diganti: primitif DB (selectRows/insertRow/updateRows/
// upsertRows/deleteRows) lewat Postgres langsung (pg), bukan
// PostgREST. Helper murni (JWT, S3, format, dsb) di-reuse dari
// functions/lib/core.js agar tidak ada duplikasi logika.
// ============================================================

import pg from 'pg'
import {
  json,
  ApiError,
  toCamel,
  toCamelList,
  makeId,
  normalizeTime,
  wibNow,
  countDays,
  publicUser,
  isAdminUser,
  isSuperadminUser,
  b64uEncode,
  b64uDecode,
  hmacKey,
  signToken,
  verifyToken,
  clientIp,
  envOf,
  s3Client,
  s3Base,
  parsePhotoDataUrl,
  s3UploadAvatar,
  s3DeleteAvatar,
  haversine,
  PUBLIC_FIELDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  MAX_PER_USER,
} from '../../functions/lib/core.js'

const { Pool, types } = pg

// PostgREST mengembalikan DATE sebagai 'YYYY-MM-DD' (string).
// Parser bawaan pg mengubah DATE jadi objek Date (bergeser timezone
// saat di-JSON-kan). Samakan dengan perilaku lama: kembalikan string.
types.setTypeParser(1082, (v) => v)

// ---------- Pool ----------

let _pool = null
let _poolKey = null

function getPool(env) {
  const cs = env?.DATABASE_URL
  if (!cs) throw new ApiError('DATABASE_URL belum dikonfigurasi di server', 500)
  if (_pool && _poolKey === cs) return _pool
  _pool = new Pool({ connectionString: cs, max: 10, idleTimeoutMillis: 30_000 })
  _pool.on('error', (err) => console.error('[pg] pool error:', err?.message || err))
  _poolKey = cs
  return _pool
}

async function q(env, text, params = []) {
  try {
    const res = await getPool(env).query(text, params)
    return res.rows
  } catch (err) {
    throw new ApiError(`Database error: ${err?.message || err}`, 500)
  }
}

// ---------- Validasi identifier ----------

const TABLES = new Set([
  'users',
  'leave_balances',
  'leave_adjustments',
  'clock_records',
  'pending_clocks',
  'pengajuan',
  'announcements',
  'announcement_reads',
  'events',
  'vouchers',
  'notifications',
  'push_subscriptions',
  'locations',
  'holidays',
  'okr_inputs',
  'settings',
  'didit_webhooks',
  'login_attempts',
  'audit_logs',
  'user_jobs',
])

function t(name) {
  if (!TABLES.has(name)) throw new ApiError(`Tabel tidak dikenal: ${name}`, 500)
  return `"${name}"`
}

function c(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new ApiError(`Kolom tidak valid: ${name}`, 500)
  return `"${name}"`
}

function selectList(select) {
  if (!select || select === '*') return '*'
  return String(select)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(c)
    .join(', ')
}

// ---------- Filter / order / limit (kompatibel PostgREST) ----------

const OPS = {
  eq: '=',
  neq: '<>',
  gte: '>=',
  lte: '<=',
  gt: '>',
  lt: '<',
}

function whereClause(filter = [], startIdx = 1) {
  const parts = []
  const vals = []
  let i = startIdx
  for (const f of filter || []) {
    const op = f.op || 'eq'
    if (op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : String(f.value).split(',')
      parts.push(`${c(f.col)} = ANY($${i++})`)
      vals.push(arr)
      continue
    }
    const sql = OPS[op]
    if (!sql) throw new ApiError(`Operator filter tidak didukung: ${op}`, 500)
    parts.push(`${c(f.col)} ${sql} $${i++}`)
    vals.push(f.value)
  }
  return { clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '', vals, next: i }
}

function orderClause(order) {
  if (!order) return ''
  const parts = String(order)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, dir = 'asc'] = s.split('.')
      const d = dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      return `${c(name)} ${d}`
    })
  return parts.length ? `ORDER BY ${parts.join(', ')}` : ''
}

// Kompatibilitas: modul hasil sync mendestruktur pgReq & buildParams
// tapi tidak pernah memanggilnya langsung. buildParams tetap murni,
// pgReq sengaja dimatikan (tidak ada lagi PostgREST).
function buildParams({ select, filter = [], order, limit }) {
  const params = new URLSearchParams()
  if (select) params.set('select', select)
  for (const f of filter) params.append(f.col, `${f.op || 'eq'}.${f.value}`)
  if (order) params.append('order', order)
  if (limit) params.append('limit', String(limit))
  return params
}

async function pgReq() {
  throw new ApiError('pgReq tidak tersedia di server pg (tidak ada PostgREST)', 500)
}

// ---------- Primitif DB ----------

async function selectRows(env, table, opts = {}) {
  const { select, filter = [], order, limit } = opts
  const { clause, vals } = whereClause(filter)
  let sql = `SELECT ${selectList(select)} FROM ${t(table)} ${clause} ${orderClause(order)}`
  if (limit) sql += ` LIMIT ${Number(limit)}`
  return q(env, sql, vals)
}

async function insertRow(env, table, body, { select = '*' } = {}) {
  const keys = Object.keys(body || {})
  if (keys.length === 0) throw new ApiError('Body insert kosong', 400)
  const vals = keys.map((k) => body[k])
  const cols = keys.map(c).join(', ')
  const holders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await q(
    env,
    `INSERT INTO ${t(table)} (${cols}) VALUES (${holders}) RETURNING ${selectList(select)}`,
    vals
  )
  return rows[0]
}

async function updateRows(env, table, filter, patch, { select = '*' } = {}) {
  const keys = Object.keys(patch || {})
  if (keys.length === 0) return undefined
  const setVals = keys.map((k) => patch[k])
  const setClause = keys.map((k, i) => `${c(k)} = $${i + 1}`).join(', ')
  const { clause, vals } = whereClause(filter, setVals.length + 1)
  const rows = await q(
    env,
    `UPDATE ${t(table)} SET ${setClause} ${clause} RETURNING ${selectList(select)}`,
    [...setVals, ...vals]
  )
  return rows[0]
}

async function upsertRows(env, table, body, onConflict, { select = '*' } = {}) {
  const keys = Object.keys(body || {})
  if (keys.length === 0) throw new ApiError('Body upsert kosong', 400)
  const conflictCols = String(onConflict)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (conflictCols.length === 0) throw new ApiError('onConflict wajib diisi', 500)
  const others = keys.filter((k) => !conflictCols.includes(k))
  const vals = keys.map((k) => body[k])
  const cols = keys.map(c).join(', ')
  const holders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const updateSet =
    others.length > 0
      ? others.map((k) => `${c(k)} = EXCLUDED.${c(k)}`).join(', ')
      : `${c(keys[0])} = EXCLUDED.${c(keys[0])}`
  const rows = await q(
    env,
    `INSERT INTO ${t(table)} (${cols}) VALUES (${holders}) ` +
      `ON CONFLICT (${conflictCols.map(c).join(', ')}) DO UPDATE SET ${updateSet} ` +
      `RETURNING ${selectList(select)}`,
    vals
  )
  return rows[0]
}

async function deleteRows(env, table, filter) {
  const { clause, vals } = whereClause(filter)
  if (!clause) throw new ApiError('deleteRows tanpa filter ditolak', 500)
  await q(env, `DELETE FROM ${t(table)} ${clause}`, vals)
  return null
}

// ---------- Notifikasi internal (sama semantik dengan core.js) ----------

async function notify(env, userIds, type, title, body, refId, refType, link) {
  const ids = [...new Set((userIds || []).map(String))].filter(Boolean)
  if (ids.length === 0) return
  for (const userId of ids) {
    await insertRow(env, 'notifications', {
      id: makeId('ntf'),
      user_id: userId,
      type,
      title,
      body: body || '',
      ref_id: refId || null,
      ref_type: refType || null,
      link: link || '',
    })
  }
  // Prune: simpan maksimal MAX_PER_USER notifikasi terbaru per user.
  for (const userId of ids) {
    const stale = await q(
      env,
      `SELECT "id" FROM "notifications" WHERE "user_id" = $1 ORDER BY "created_at" DESC OFFSET ${Number(MAX_PER_USER)}`,
      [userId]
    )
    if (stale.length > 0) {
      await q(env, `DELETE FROM "notifications" WHERE "id" = ANY($1)`, [
        stale.map((r) => r.id),
      ])
    }
  }
  try {
    const { pushToUsers } = await import('./gen/push.js')
    await pushToUsers(env, ids, {
      title,
      body: body || '',
      url: link || '/',
      tag: `${refType || type}:${refId || ''}`,
    })
  } catch {
    // ignore — push adalah best-effort
  }
}

// ---------- Auth helpers (sama semantik dengan core.js) ----------

async function requireAuth(context) {
  const header = context.request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new ApiError('Tidak terautentikasi', 401)
  const payload = await verifyToken(token, context.env.AUTH_SECRET)
  if (!payload) throw new ApiError('Sesi tidak valid, silakan login ulang', 401)
  return payload
}

async function requireAdmin(context) {
  const user = await requireAuth(context)
  if (!isAdminUser(user)) throw new ApiError('Akses ditolak: butuh role admin', 403)
  return user
}

async function requireSuperadmin(context) {
  const user = await requireAuth(context)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'role',
    filter: [{ col: 'id', value: user.sub }],
  })
  const current = rows[0] || user
  if (current?.role !== 'superadmin') throw new ApiError('Akses ditolak: butuh role superadmin', 403)
  return user
}

async function isActorSuperadmin(context, actor) {
  if (!actor?.sub) return false
  const rows = await selectRows(envOf(context), 'users', {
    select: 'role',
    filter: [{ col: 'id', value: actor.sub }],
  })
  return rows[0]?.role === 'superadmin'
}

// ---------- Brute-force protection (sama semantik, fail-open) ----------

async function countRecentFailures(env, username, ip) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString()
  const rows = await selectRows(env, 'login_attempts', {
    select: 'id',
    filter: [
      { col: 'username', value: username },
      { col: 'ip', value: ip },
      { col: 'success', value: false },
      { col: 'created_at', op: 'gt', value: since },
    ],
  })
  return rows.length
}

async function recordLoginAttempt(env, username, ip, success) {
  try {
    await insertRow(env, 'login_attempts', { username, ip, success })
  } catch {
    // fail-open
  }
}

async function enforceLoginRateLimit(context, username) {
  const env = envOf(context)
  try {
    const fails = await countRecentFailures(env, username, clientIp(context))
    if (fails >= LOGIN_MAX_FAILURES) {
      throw new ApiError(
        'Terlalu banyak percobaan login yang gagal. Coba lagi dalam 15 menit.',
        429
      )
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    // fail-open bila tabel tidak tersedia
  }
}

// ---------- Audit log (sama semantik dengan core.js) ----------

async function writeAudit(env, actor, action, targetType, targetId, detail, { strict = false } = {}) {
  const actorId = actor?.sub || actor?.id
  if (actorId) {
    try {
      const rows = await selectRows(env, 'users', {
        select: 'role',
        filter: [{ col: 'id', value: actorId }],
      })
      if (rows[0]?.role === 'superadmin') return
    } catch {
      // Gagal cek role — tetap tulis audit.
    }
  }
  try {
    await insertRow(env, 'audit_logs', {
      id: makeId('aud'),
      actor_id: actorId || null,
      actor_name: actor?.username || actor?.fullName || null,
      action,
      target_type: targetType || null,
      target_id: targetId ? String(targetId).slice(0, 64) : null,
      detail: detail || {},
    })
  } catch (err) {
    console.error('[audit] gagal menulis audit log:', action, String(err?.message || err))
    if (strict) {
      throw new ApiError(`Audit log gagal ditulis (${action}): ${String(err?.message || err)}`, 500)
    }
  }
}

async function auditCtxStrict(context, action, targetType, targetId, detail) {
  const actor = context.user
  await writeAudit(envOf(context), actor, action, targetType, targetId, detail, { strict: true })
}

async function auditCtx(context, action, targetType, targetId, detail) {
  const actor = context.user
  if (!actor) return
  await writeAudit(envOf(context), actor, action, targetType, targetId, detail)
}

// ---------- Geolocation (sama semantik dengan core.js) ----------

async function assertClockLocation(env, lat, lng) {
  const rows = await selectRows(env, 'locations', { select: '*', limit: 500 })
  if (rows.length === 0) return null
  if (lat == null || lng == null) {
    const err = new ApiError('Lokasi wajib dikirim saat absen', 400)
    err.code = 'LOCATION_REQUIRED'
    throw err
  }
  let nearest = null
  let minDist = Infinity
  for (const loc of rows) {
    const d = haversine(Number(lat), Number(lng), Number(loc.lat), Number(loc.lng))
    if (d < minDist) {
      minDist = d
      nearest = loc
    }
  }
  if (!nearest || minDist > (nearest.radius || 100)) {
    const err = new ApiError('Anda berada di luar radius lokasi kantor', 403)
    err.code = 'OUT_OF_RADIUS'
    throw err
  }
  return { location: nearest.name, distance: Math.round(minDist) }
}

// ---------- Exports (nama & urutan sama dengan core.js) ----------

export {
  json,
  ApiError,
  toCamel,
  toCamelList,
  makeId,
  normalizeTime,
  wibNow,
  countDays,
  publicUser,
  isAdminUser,
  isSuperadminUser,
  b64uEncode,
  b64uDecode,
  hmacKey,
  signToken,
  verifyToken,
  pgReq,
  buildParams,
  selectRows,
  insertRow,
  updateRows,
  upsertRows,
  deleteRows,
  notify,
  requireAuth,
  requireAdmin,
  requireSuperadmin,
  isActorSuperadmin,
  clientIp,
  countRecentFailures,
  recordLoginAttempt,
  enforceLoginRateLimit,
  writeAudit,
  auditCtxStrict,
  auditCtx,
  s3Client,
  s3Base,
  parsePhotoDataUrl,
  s3UploadAvatar,
  s3DeleteAvatar,
  envOf,
  PUBLIC_FIELDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  MAX_PER_USER,
  haversine,
  assertClockLocation,
  getPool,
}

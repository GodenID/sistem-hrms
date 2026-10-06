import { AwsClient } from 'aws4fetch'
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

class ApiError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

// ---------- Konversi ----------

function toCamel(row) {
  if (!row || typeof row !== 'object') return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return out
}

function toCamelList(rows) {
  return (rows || []).map(toCamel)
}

function makeId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${Date.now().toString(36)}${hex}`
}

function normalizeTime(value) {
  if (!value) return null
  const m = String(value).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = String(m[1]).padStart(2, '0')
  return `${h}:${m[2]}` + (m[3] ? `:${m[3]}` : '')
}

// Waktu server dalam zona WIB (UTC+7). Dipakai untuk absen agar tanggal &
// jam tidak bisa dimanipulasi dari client. offsetDays memungkinkan melihat
// tanggal hari kemarin (untuk jam kerja lintas tengah malam).
function wibNow(offsetDays = 0, date = new Date()) {
  const ms = date.getTime() + (7 + offsetDays * 24) * 3600 * 1000
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  }
}

function countDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

function publicUser(row) {
  if (!row) return null
  const u = toCamel(row)
  delete u.password
  // Bentuk kontak darurat sebagai objek sesuai yang dibaca frontend.
  u.emergencyContact = {
    name: u.emergencyContactName || '',
    phone: u.emergencyContactPhone || '',
  }
  delete u.emergencyContactName
  delete u.emergencyContactPhone
  return u
}

function isAdminUser(user) {
  return user?.role === 'admin' || user?.role === 'superadmin' || user?.userType === 'admin'
}

function isSuperadminUser(user) {
  return user?.role === 'superadmin'
}

// ---------- JWT (HS256 via Web Crypto) ----------

function b64uEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64uDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  )
}

async function signToken(user, secret) {
  const header = b64uEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64uEncode(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      role: user.role,
      userType: user.user_type,
      iat: now,
      exp: now + 60 * 60 * 24 * 30,
    })
  )
  const key = await hmacKey(secret, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64uEncode(new Uint8Array(sig))}`
}

async function verifyToken(token, secret) {
  try {
    const [header, payload, sig] = String(token).split('.')
    if (!header || !payload || !sig) return null
    const key = await hmacKey(secret, ['verify'])
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64uDecode(sig),
      new TextEncoder().encode(`${header}.${payload}`)
    )
    if (!ok) return null
    const data = JSON.parse(new TextDecoder().decode(b64uDecode(payload)))
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

// ---------- DB layer (PostgREST) ----------

async function pgReq(env, path, { method = 'GET', body, headers = {} } = {}) {
  const base = (env.SUPABASE_URL || '').replace(/\/+$/, '')
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = j.message || j.details || JSON.stringify(j)
    } catch {
      // keep statusText
    }
    throw new ApiError(detail, res.status)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function buildParams({ select, filter = [], order, limit }) {
  const params = new URLSearchParams()
  if (select) params.set('select', select)
  for (const f of filter) params.append(f.col, `${f.op || 'eq'}.${f.value}`)
  if (order) params.append('order', order)
  if (limit) params.append('limit', String(limit))
  return params
}

async function selectRows(env, table, opts = {}) {
  const rows = await pgReq(env, `${table}?${buildParams(opts).toString()}`)
  return Array.isArray(rows) ? rows : []
}

async function insertRow(env, table, body, { select = '*' } = {}) {
  const rows = await pgReq(env, `${table}?select=${encodeURIComponent(select)}`, {
    method: 'POST',
    body,
    headers: { Prefer: 'return=representation' },
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function updateRows(env, table, filter, patch, { select = '*' } = {}) {
  const params = buildParams({ select, filter })
  const rows = await pgReq(env, `${table}?${params.toString()}`, {
    method: 'PATCH',
    body: patch,
    headers: { Prefer: 'return=representation' },
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function upsertRows(env, table, body, onConflict, { select = '*' } = {}) {
  const rows = await pgReq(
    env,
    `${table}?on_conflict=${encodeURIComponent(onConflict)}&select=${encodeURIComponent(select)}`,
    {
      method: 'POST',
      body,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    }
  )
  return Array.isArray(rows) ? rows[0] : rows
}

async function deleteRows(env, table, filter) {
  const params = new URLSearchParams()
  for (const f of filter) params.append(f.col, `${f.op || 'eq'}.${f.value}`)
  return pgReq(env, `${table}?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

// ---------- Notifikasi internal ----------

const MAX_PER_USER = 100

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
  for (const userId of ids) {
    const rows = await selectRows(env, 'notifications', {
      select: 'id',
      filter: [{ col: 'user_id', value: userId }],
      order: 'created_at.desc',
    })
    const extra = rows.slice(MAX_PER_USER)
    if (extra.length > 0) {
      const idsStr = extra.map((r) => encodeURIComponent(r.id)).join(',')
      await pgReq(env, `notifications?id=in.(${idsStr})`, { method: 'DELETE' })
    }
  }
  // Web Push: kirim juga ke semua subscription user (gagal push tidak
  // boleh mematahkan notifikasi in-app). Dynamic import menghindari
  // circular dependency (push.js mengimpor helper dari core.js).
  try {
    const { pushToUsers } = await import('./push.js')
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

// ---------- Auth helpers ----------

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
  // Cek role dari database, bukan dari token — supaya penurunan role
  // langsung berlaku tanpa menunggu token lama kadaluarsa.
  const rows = await selectRows(envOf(context), 'users', {
    select: 'role',
    filter: [{ col: 'id', value: user.sub }],
  })
  const current = rows[0] || user
  if (!isSuperadminUser(current)) throw new ApiError('Akses ditolak: butuh role superadmin', 403)
  return user
}

// Role aktor dibaca segar dari DB (bukan dari token) untuk semua aksi
// yang menyentuh role superadmin — penurunan role langsung berlaku.
async function isActorSuperadmin(context, actor) {
  if (!actor?.sub) return false
  const rows = await selectRows(envOf(context), 'users', {
    select: 'role',
    filter: [{ col: 'id', value: actor.sub }],
  })
  return rows[0]?.role === 'superadmin'
}

// ---------- Brute-force protection (login) ----------

const LOGIN_MAX_FAILURES = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 menit

function clientIp(context) {
  return (
    context.request.headers.get('cf-connecting-ip') ||
    context.request.headers.get('x-real-ip') ||
    context.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  )
}

// Fail-open: bila tabel login_attempts belum ada atau query gagal,
// biarkan login berjalan normal (jangan sampai menghambat user sah).
async function countRecentFailures(env, username, ip) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString()
  const rows = await pgReq(
    env,
    `login_attempts?select=id&username=eq.${encodeURIComponent(username)}&ip=eq.${encodeURIComponent(ip)}&success=eq.false&created_at=gt.${encodeURIComponent(since)}`
  )
  return Array.isArray(rows) ? rows.length : 0
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
        `Terlalu banyak percobaan login yang gagal. Coba lagi dalam 15 menit.`,
        429
      )
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    // fail-open bila tabel tidak tersedia
  }
}

// ---------- Audit log (riwayat aksi) ----------

async function writeAudit(env, actor, action, targetType, targetId, detail, { strict = false } = {}) {
  // Stealth mode: aksi superadmin TIDAK ditulis ke audit log — admin
  // biasa tidak melihat jejaknya. Role dicek segar dari DB, jadi kalau
  // superadmin diturunkan, aksinya kembali tercatat seperti biasa.
  const actorId = actor?.sub || actor?.id
  if (actorId) {
    try {
      const rows = await selectRows(env, 'users', {
        select: 'role',
        filter: [{ col: 'id', value: actorId }],
      })
      if (rows[0]?.role === 'superadmin') return
    } catch {
      // Gagal cek role — tetap tulis audit (jangan sampai stealth
      // berubah menjadi error yang membatalkan aksi).
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
    // fail-open untuk aksi biasa; strict melempar error supaya aksi
    // berbahaya (non-superadmin) tidak pernah lolos tanpa jejak audit.
    console.error('[audit] gagal menulis audit log:', action, String(err?.message || err))
    if (strict) {
      throw new ApiError(`Audit log gagal ditulis (${action}): ${String(err?.message || err)}`, 500)
    }
  }
}

// Audit strict untuk aksi superadmin: kalau audit gagal, aksi dibatalkan.
async function auditCtxStrict(context, action, targetType, targetId, detail) {
const actor = context.user
  await writeAudit(envOf(context), actor, action, targetType, targetId, detail, { strict: true })
}
// Variasi ringkas: actor diambil dari token (di-set router), lalu tulis audit (fail-open).
async function auditCtx(context, action, targetType, targetId, detail) {
  const actor = context.user
  if (!actor) return
  await writeAudit(envOf(context), actor, action, targetType, targetId, detail)
}

const PUBLIC_FIELDS =
  'id, username, full_name, role, user_type, ktp, nik, division, birth_place, birth_date, sex, address, ktp_verified, avatar_color, avatar_url, phone, personal_email, emergency_contact_name, emergency_contact_phone, suspended, primary_jobs, created_at'

// ---------- S3 (Onidel) — foto profil ----------

function s3Client(env) {
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
    region: env.S3_REGION || 'ap-southeast-1',
    service: 's3',
  })
}

function s3Base(env) {
  const endpoint = (env.S3_ENDPOINT || 'https://s3.ap-southeast-1.onidel.cloud').replace(/\/+$/, '')
  const bucket = env.S3_BUCKET || 'hrmsprasastigroup'
  return { endpoint, bucket }
}

function parsePhotoDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) throw new ApiError('Format foto tidak valid (harus data URL JPEG/PNG/WEBP)', 400)
  const type = m[1]
  const bin = atob(m[2])
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  if (bytes.length === 0) throw new ApiError('File foto kosong', 400)
  if (bytes.length > 10 * 1024 * 1024) throw new ApiError('Ukuran foto maksimal 10 MB', 400)
  return { type, bytes }
}

// Upload foto ke S3; menghapus foto lama (bila ada) agar tidak menumpuk.
// Mengembalikan URL publik.
async function s3UploadAvatar(env, userId, dataUrl, oldUrl) {
  const { type, bytes } = parsePhotoDataUrl(dataUrl)
  const { endpoint, bucket } = s3Base(env)
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const key = `avatars/${userId}-${Date.now()}.${ext}`
  const url = `${endpoint}/${bucket}/${key}`
  const res = await s3Client(env).fetch(url, {
    method: 'PUT',
    headers: { 'content-type': type, 'x-amz-acl': 'public-read' },
    body: bytes,
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new ApiError(`Gagal upload foto ke penyimpanan (${res.status}): ${detail}`, 502)
  }
  // Hapus foto lama (bukan file baru)
  await s3DeleteAvatar(env, oldUrl).catch(() => {})
  return url
}

async function s3DeleteAvatar(env, url) {
  if (!url) return
  const { endpoint, bucket } = s3Base(env)
  const prefix = `${endpoint.replace(/\/+$/, '')}/${bucket}/`
  if (!String(url).startsWith(prefix)) return
  const key = String(url).slice(prefix.length)
  if (!key || key.includes('..')) return
  await s3Client(env).fetch(`${endpoint}/${bucket}/${key}`, { method: 'DELETE' })
}

// ---------- AUTH ROUTES ----------

function envOf(context) {
  return context.env
}

// ---------- Geolocation (absensi) ----------

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Validasi lokasi absen di sisi server. Bila belum ada lokasi terkonfigurasi,
// absen diizinkan tanpa cek lokasi (perilaku lama). Bila ada, wajib mengirim
// lat/lng dan harus berada dalam radius lokasi kantor terdekat.
export async function assertClockLocation(env, lat, lng) {
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

// ---------- Exports ----------

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
}


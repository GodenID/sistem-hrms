// ============================================================
// Client API HRMS — memanggil Pages Functions (/api/*).
// Login & otorisasi divalidasi server-side di worker.
// Token JWT disimpan di localStorage.
// ============================================================

const TOKEN_KEY = 'hrms_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code || null
  }
}

// ---------- Helpers konversi ----------

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

function toSnake(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined) continue
    out[k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())] = v
  }
  return out
}

function normalizeTime(value) {
  if (!value) return null
  const m = String(value).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = String(m[1]).padStart(2, '0')
  return `${h}:${m[2]}` + (m[3] ? `:${m[3]}` : '')
}

function countDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

export function publicUser(row) {
  if (!row) return null
  const u = toCamel(row)
  delete u.password
  return u
}

function sessionUserId() {
  try {
    const token = getToken()
    if (!token) return null
    const [, payload] = token.split('.')
    if (!payload) return null
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return data?.sub || null
  } catch {
    return null
  }
}

function isAdminUser(user) {
  return user?.role === 'admin' || user?.userType === 'admin'
}

// ---------- Request core ----------

// Base URL API eksternal (Coolify). Kosong = mode lama (relatif /api/*
// ke Pages Functions di domain yang sama). Isi via env Pages:
//   VITE_API_URL=https://api-hrms.prasastigroup.id
const API_BASE = (import.meta?.env?.VITE_API_URL || '').replace(/\/+$/, '')

function buildUrl(path) {
  const [pathname, queryString] = String(path).split('?')
  const p = pathname.startsWith('/') ? pathname : '/' + pathname
  if (API_BASE) {
    const root = API_BASE.replace(/\/api$/, '')
    return { url: new URL(root + '/api' + p), queryString }
  }
  url.pathname = '/api' + url.pathname
  return { url, queryString }
}

function apiPathname(url) {
  // Path API tanpa prefix /api (untuk pengecualian 401 login).
  return url.pathname.replace(/^\/api/, '') || '/'
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const { url, queryString } = buildUrl(path)
  httpParam(url, queryString)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const pathname = apiPathname(url)

  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new ApiError('Tidak dapat terhubung ke server', 0)
  }

  let data = null
  if (res.status !== 204) {
    const text = await res.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }
  }

  if (!res.ok) {
    const message = data?.error || `Request gagal (${res.status})`
    if (res.status === 401 && !pathname.startsWith('/auth/login') && !pathname.startsWith('/auth/verify-username')) {
      clearToken()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    throw new ApiError(message, res.status, data?.code)
  }

  return data
}

function httpParam(url, queryString) {
  if (!queryString) return
  for (const [k, v] of new URLSearchParams(queryString).entries()) {
    url.searchParams.set(k, v)
  }
}
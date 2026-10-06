// ============================================================
// HRMS API Router — Cloudflare Pages Functions
// Tabel route declarative + middleware auth terpusat.
// Semua handler tinggal membaca context.user (payload JWT terverifikasi).
// Satu sumber kebenaran: functions/lib/* — functions/api/[[path]].js,
// functions/[[path]].js, dan __api.js hanyalah wrapper tipis.
// ============================================================

import * as core from './core.js'
import { auditLogsList } from './audit.js'
import * as auth from './auth.js'
import * as users from './users.js'
import * as clock from './clock.js'
import * as pengajuan from './pengajuan.js'
import * as announcements from './announcements.js'
import * as events from './events.js'
import * as notifications from './notifications.js'
import * as locations from './locations.js'
import * as holidays from './holidays.js'
import * as okr from './okr.js'
import * as didit from './didit.js'
import * as push from './push.js'

const { json, ApiError, envOf } = core

// Level akses: 'public' | 'user' | 'admin' | 'superadmin'
const ROUTES = []
const route = (method, parts, level, handler) => ROUTES.push({ method, parts, level, handler })

// Route untuk wrapper root (functions/[[path]].js): HANYA health check.
// API lengkap hanya diekspos di /api/* (functions/api/[[path]].js) — kalau
// tabel API penuh dipakai di root, path SPA seperti /pengajuan atau /events
// ikut dicocokkan ke route API (butuh auth) dan refresh halaman jadi 401.
export const ROOT_ROUTES = [
  { method: 'GET', parts: ['health'], level: 'public', handler: () =>
    json({ status: 'ok', env: 'production', time: new Date().toISOString() }) },
]

// ---------- Sistem ----------
route('GET', ['health'], 'public', () =>
  json({ status: 'ok', env: 'production', time: new Date().toISOString() })
)

// ---------- Didit OCR proxy ----------
route('POST', ['didit', 'verify'], 'public', didit.diditProxy)
route('POST', ['didit', 'session'], 'public', didit.diditCreateSession)
route('GET', ['didit', 'decision'], 'public', (c, b, q) => didit.diditDecision(c, q))

// ---------- Auth ----------
route('POST', ['auth', 'login'], 'public', auth.authLogin)
route('POST', ['auth', 'register'], 'public', (c, b) => auth.authRegister(envOf(c), b))
route('GET', ['auth', 'me'], 'user', auth.authMe)
route('POST', ['auth', 'verify-username'], 'public', (c, b) => auth.authVerifyUsername(envOf(c), b))
route('POST', ['auth', 'verify-ktp'], 'public', (c, b) => auth.authVerifyKtp(envOf(c), b))
route('POST', ['auth', 'reset-password'], 'public', auth.authResetPassword)
route('POST', ['auth', 'change-password'], 'user', auth.authChangePassword)
route('PUT', ['auth', 'profile'], 'user', auth.authUpdateProfile)

// ---------- Users & Cuti ----------
route('GET', ['users'], 'user', users.usersList)
route('POST', ['users'], 'admin', users.usersCreate)
route('PUT', ['users', '{id}'], 'admin', (c, b, q, p) => users.usersUpdate(c, p[0], b))
route('PATCH', ['users', '{id}', 'role'], 'admin', (c, b, q, p) => users.usersSetRole(c, p[0], b))
route('GET', ['users', 'leave', 'balances'], 'user', (c, b, q) => users.leaveBalances(c, q))
route('PUT', ['users', 'leave', 'balance'], 'admin', users.leaveBalanceUpsert)
route('GET', ['users', 'leave', 'balance', '{userId}'], 'user', (c, b, q, p) =>
  users.leaveBalanceByUser(c, p[0], q.year || new Date().getFullYear())
)
route('POST', ['users', 'leave', 'deduct'], 'admin', users.leaveDeduct)
route('POST', ['users', 'leave', 'adjust'], 'admin', users.leaveAdjust)
route('GET', ['users', 'leave', 'adjustments', '{userId}'], 'user', (c, b, q, p) =>
  users.leaveAdjustmentsByUser(c, p[0])
)

// ---------- Absensi (Clock) ----------
route('GET', ['clock', 'history'], 'user', (c, b, q) => clock.clockHistory(c, q))
route('POST', ['clock', 'in'], 'user', clock.clockIn)
route('POST', ['clock', 'out'], 'user', clock.clockOut)
route('PUT', ['clock', 'record'], 'admin', clock.clockRecordPut)
route('GET', ['clock', 'pending'], 'user', clock.clockPendingList)
route('POST', ['clock', 'pending'], 'user', clock.clockPendingCreate)
route('POST', ['clock', 'pending', '{id}', 'approve'], 'admin', (c, b, q, p) => clock.clockPendingApprove(c, p[0]))
route('POST', ['clock', 'pending', '{id}', 'reject'], 'admin', (c, b, q, p) => clock.clockPendingReject(c, p[0]))

// ---------- Pengajuan ----------
route('GET', ['pengajuan'], 'user', pengajuan.pengajuanList)
route('POST', ['pengajuan'], 'user', pengajuan.pengajuanCreate)
route('PUT', ['pengajuan', '{id}', 'status'], 'admin', (c, b, q, p) => pengajuan.pengajuanStatus(c, p[0], b))
route('DELETE', ['pengajuan', '{id}'], 'user', (c, b, q, p) => pengajuan.pengajuanDelete(c, p[0]))

// ---------- Audit ----------
route('GET', ['audit'], 'admin', auditLogsList)

// ---------- Announcements ----------
route('GET', ['announcements'], 'user', announcements.announcementsList)
route('POST', ['announcements'], 'admin', announcements.announcementsCreate)
route('PUT', ['announcements', '{id}'], 'admin', (c, b, q, p) => announcements.announcementsUpdate(c, p[0], b))
route('DELETE', ['announcements', '{id}'], 'admin', (c, b, q, p) => announcements.announcementsDelete(c, p[0]))
route('POST', ['announcements', '{id}', 'read'], 'user', (c, b, q, p) => announcements.announcementMarkRead(c, p[0]))
route('GET', ['announcements', '{id}', 'reads'], 'admin', (c, b, q, p) => announcements.announcementReads(c, p[0]))

// ---------- Events & Vouchers ----------
route('GET', ['events'], 'user', events.eventsList)
route('POST', ['events'], 'user', events.eventsCreate)
route('GET', ['events', 'po-thresholds'], 'user', events.eventsThresholdsGet)
route('PUT', ['events', 'po-thresholds'], 'admin', events.eventsThresholdsPut)
route('GET', ['events', '{eventId}', 'vouchers'], 'user', (c, b, q, p) => events.vouchersList(c, p[0]))
route('POST', ['events', '{eventId}', 'vouchers'], 'user', (c, b, q, p) => events.vouchersCreate(c, p[0], b))
route('PUT', ['events', '{eventId}', 'vouchers', '{voucherId}'], 'user', (c, b, q, p) =>
  events.vouchersUpdate(c, p[0], p[1], b)
)
route('DELETE', ['events', '{eventId}', 'vouchers', '{voucherId}'], 'user', (c, b, q, p) =>
  events.vouchersDelete(c, p[0], p[1])
)
route('PUT', ['events', '{id}'], 'user', (c, b, q, p) => events.eventsUpdate(c, p[0], b))
route('DELETE', ['events', '{id}'], 'user', (c, b, q, p) => events.eventsDelete(c, p[0]))

// ---------- Notifications ----------
route('GET', ['notifications'], 'user', notifications.notificationsList)
route('DELETE', ['notifications'], 'user', notifications.notificationsClearAll)
route('PUT', ['notifications', 'read-all'], 'user', notifications.notificationsMarkAllRead)
route('PUT', ['notifications', '{id}', 'read'], 'user', (c, b, q, p) => notifications.notificationsMarkRead(c, p[0]))
route('DELETE', ['notifications', '{id}'], 'user', (c, b, q, p) => notifications.notificationsDelete(c, p[0]))

// ---------- Push Notifications (Web Push) ----------
route('GET', ['push', 'public-key'], 'public', (c) => push.pushPublicKey(c))
route('POST', ['push', 'subscribe'], 'user', (c, b) => push.pushSubscribe(c, b))
route('POST', ['push', 'unsubscribe'], 'user', (c, b) => push.pushUnsubscribe(c, b))
route('POST', ['push', 'send'], 'user', (c, b) => push.pushSendSelf(c, b))

// ---------- Locations ----------
route('GET', ['locations'], 'user', locations.locationsList)
route('POST', ['locations'], 'admin', locations.locationsCreate)
route('PUT', ['locations', '{id}'], 'admin', (c, b, q, p) => locations.locationsUpdate(c, p[0], b))
route('DELETE', ['locations', '{id}'], 'admin', (c, b, q, p) => locations.locationsDelete(c, p[0]))

// ---------- Holidays (auto-sync, tanpa input manual — POST/PUT/DELETE dinonaktifkan, hanya GET) ----------
route('GET', ['holidays'], 'user', (c, b, q) => holidays.holidaysList(c, q))

// ---------- OKR ----------
route('GET', ['okr', 'users'], 'user', okr.okrUsersList)
route('POST', ['okr', 'users'], 'admin', okr.okrUsersCreate)
route('PUT', ['okr', 'users', '{username}'], 'admin', (c, b, q, p) => okr.okrUsersUpdate(c, p[0], b))
route('DELETE', ['okr', 'users', '{username}'], 'admin', (c, b, q, p) => okr.okrUsersDelete(c, p[0]))
route('PATCH', ['okr', 'users', '{username}', 'suspend'], 'admin', (c, b, q, p) =>
  okr.okrUsersSetSuspended(c, p[0], true)
)
route('PATCH', ['okr', 'users', '{username}', 'activate'], 'admin', (c, b, q, p) =>
  okr.okrUsersSetSuspended(c, p[0], false)
)
route('POST', ['okr', 'users', '{username}', 'jobs'], 'admin', (c, b, q, p) => okr.okrJobCreate(c, p[0], b))
route('PUT', ['okr', 'users', '{username}', 'jobs', '{jobId}'], 'admin', (c, b, q, p) =>
  okr.okrJobUpdate(c, p[0], p[1], b)
)
route('DELETE', ['okr', 'users', '{username}', 'jobs', '{jobId}'], 'admin', (c, b, q, p) =>
  okr.okrJobDelete(c, p[0], p[1])
)
route('GET', ['okr', 'inputs'], 'user', (c, b, q) => okr.okrInputsList(c, q))
route('POST', ['okr', 'inputs'], 'user', okr.okrInputCreate)
route('GET', ['okr', 'inputs', 'dates'], 'user', (c, b, q) => okr.okrInputDates(c, q))
route('GET', ['okr', 'inputs', 'all-dates'], 'admin', okr.okrInputAllDates)
route('PUT', ['okr', 'inputs', '{id}'], 'user', (c, b, q, p) => okr.okrInputUpdate(c, p[0], b))
route('DELETE', ['okr', 'inputs', '{id}'], 'user', (c, b, q, p) => okr.okrInputDelete(c, p[0]))
route('GET', ['okr', 'team'], 'user', (c, b, q) => okr.okrTeam(c, q))

// ---------- Superadmin ----------
route('POST', ['superadmin', 'reset-password'], 'superadmin', users.superadminResetPassword)
route('PUT', ['superadmin', 'leave-balance'], 'superadmin', users.superadminLeaveBalance)
route('DELETE', ['superadmin', 'users', '{username}'], 'superadmin', (c, b, q, p) =>
  users.superadminDeleteUser(c, p[0])
)

// ---------- Admin (hapus karyawan) ----------
route('DELETE', ['users', '{id}'], 'admin', (c, b, q, p) => users.adminDeleteUser(c, p[0]))

function matchRoute(parts, method, routes = ROUTES) {
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== parts.length) continue
    const params = []
    let ok = true
    for (let i = 0; i < r.parts.length; i++) {
      const want = r.parts[i]
      if (want.startsWith('{')) {
        params.push(parts[i])
        continue
      }
      if (want !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { level: r.level, handler: r.handler, params }
  }
  return null
}

// Middleware auth terpusat — handler tidak perlu memanggil requireAuth lagi.
async function guard(level, context) {
  if (level === 'user') return core.requireAuth(context)
  if (level === 'admin') return core.requireAdmin(context)
  if (level === 'superadmin') return core.requireSuperadmin(context)
  return null
}

export function createApi({ routes = ROUTES, assetsFallback = false } = {}) {
  return async function onRequest(context) {
    const { request, params } = context
    const rawPath = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')
    const pathname = '/' + rawPath
    const method = request.method
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams.entries())
    const parts = pathname.split('/').filter(Boolean)

    try {
      const body = method === 'GET' || method === 'DELETE' ? {} : await request.json().catch(() => ({}))
      const routeMatch = matchRoute(parts, method, routes)
      if (!routeMatch) {
        // File root menangkap SEMUA path (bukan hanya /api/*). Kalau tidak
        // ada route yang cocok, serahkan ke static assets — bukan 404 JSON.
        if (assetsFallback && context.env?.ASSETS) {
          return context.env.ASSETS.fetch(request)
        }
        throw new ApiError('Endpoint tidak ditemukan', 404)
      }

      const user = await guard(routeMatch.level, context)
      if (user) context.user = user

      return await routeMatch.handler(context, body, query, routeMatch.params)
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, err.status)
      }
      return json({ error: String(err?.message || 'Terjadi kesalahan server') }, 500)
    }
  }
}
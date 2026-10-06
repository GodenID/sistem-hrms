// ============================================================
// OneSignal only — VAPID custom lama dihapus sesuai request
// ============================================================

import {
  json,
  ApiError,
  makeId,
  selectRows,
  insertRow,
  updateRows,
  deleteRows,
  envOf,
} from './core.js'

async function sendViaOneSignal(env, userIds, payload) {
  const appId = env.ONESIGNAL_APP_ID || 'a0e23f3d-e5c3-4d05-b583-400940e6fe2f'
  const apiKey = env.ONESIGNAL_REST_API_KEY
  if (!apiKey) return { ok: false, reason: 'no-onesignal-key' }
  try {
    // Coba via external_id dulu (login), kalau gagal fallback ke subscription_ids
    const trySend = async (body) => {
      const res = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, text }
    }
    // 1) external_id
    let r = await trySend({
      app_id: appId,
      include_aliases: { external_id: userIds },
      include_external_user_ids: userIds,
      headings: { en: payload.title || 'Prasasti Connect' },
      contents: { en: payload.body || '' },
      web_url: payload.url || 'https://hrms.prasastigroup.id/',
      chrome_web_icon: payload.icon || 'https://hrms.prasastigroup.id/icons/icon-192.png',
    })
    if (r.ok) return { ok: true, status: r.status }
    // Jika tidak ada subscriber via external_id, coba via subscription_ids yang tersimpan di DB (fallback VAPID table dipakai untuk simpan onesignal id)
    if (r.text.includes('not subscribed') || r.text.includes('No Subscribed Users')) {
      const subs = []
      for (const uid of userIds) {
        const rows = await selectRows(env, 'push_subscriptions', {
          select: 'endpoint',
          filter: [{ col: 'user_id', value: uid }],
        })
        for (const row of rows) {
          // endpoint untuk OneSignal adalah subscriptionId (UUID), bukan URL FCM
          if (row.endpoint && row.endpoint.includes('-') && row.endpoint.length === 36) subs.push(row.endpoint)
        }
      }
      if (subs.length > 0) {
        const r2 = await trySend({
          app_id: appId,
          include_subscription_ids: subs,
          headings: { en: payload.title || 'Prasasti Connect' },
          contents: { en: payload.body || '' },
          web_url: payload.url || 'https://hrms.prasastigroup.id/',
        })
        if (r2.ok) return { ok: true, status: r2.status }
        return { ok: false, status: r2.status, reason: `onesignal ${r2.status}: ${r2.text.slice(0,300)}` }
      }
    }
    return { ok: false, status: r.status, reason: `onesignal ${r.status}: ${r.text.slice(0,300)}` }
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) }
  }
}

export async function pushToUsers(env, userIds, payload) {
  const ids = [...new Set((userIds || []).map(String))].filter(Boolean)
  if (ids.length === 0) return { sent: 0, total: 0 }
  const r = await sendViaOneSignal(env, ids, payload)
  if (r.ok) return { sent: ids.length, total: ids.length, lastError: null }
  return { sent: 0, total: ids.length, lastError: r.reason || r.status || 'onesignal-failed' }
}

export function getVapidJwk() { return null }
export function vapidPublicKey() { return null }
export async function encryptPayload() { throw new Error('VAPID dihapus, pakai OneSignal') }

export async function pushPublicKey(context) {
  return json({ enabled: true, oneSignal: true, appId: context.env.ONESIGNAL_APP_ID || 'a0e23f3d-e5c3-4d05-b583-400940e6fe2f' })
}

export async function pushSubscribe(context, body) {
  const env = envOf(context)
  const user = context.user
  const { endpoint, keys } = body || {}
  if (!endpoint) throw new ApiError('Endpoint wajib diisi', 400)
  // OneSignal: endpoint adalah subscriptionId (UUID), simpan untuk fallback include_subscription_ids
  // VAPID lama juga pakai endpoint URL — tetap simpan
  const p256dh = keys?.p256dh || 'onesignal'
  const auth = keys?.auth || 'onesignal'
  const existing = await selectRows(env, 'push_subscriptions', {
    select: 'id',
    filter: [{ col: 'endpoint', value: endpoint }],
  })
  if (existing[0]) {
    await updateRows(env, 'push_subscriptions', [{ col: 'endpoint', value: endpoint }], { user_id: user.sub, auth, p256dh })
    return json({ ok: true, via: 'onesignal' })
  }
  await insertRow(env, 'push_subscriptions', { id: makeId('pus'), user_id: user.sub, endpoint, auth, p256dh })
  return json({ ok: true, via: 'onesignal' })
}

export async function pushUnsubscribe(context, body) {
  const env = envOf(context)
  const user = context.user
  const { endpoint } = body || {}
  if (!endpoint) {
    // fallback: hapus semua untuk user ini (OneSignal logout)
    await deleteRows(env, 'push_subscriptions', [{ col: 'user_id', value: user.sub }]).catch(() => {})
    return json({ ok: true, via: 'onesignal' })
  }
  await deleteRows(env, 'push_subscriptions', [{ col: 'user_id', value: user.sub }, { col: 'endpoint', value: endpoint }]).catch(() => {})
  return json({ ok: true, via: 'onesignal' })
}

export async function pushSendSelf(context, body) {
  const env = envOf(context)
  const user = context.user
  const { title = 'Prasasti Connect', body: msg = 'Notifikasi push berfungsi!' } = body || {}
  try {
    const r = await pushToUsers(env, [user.sub], { title, body: msg, url: '/', tag: 'push:test' })
    if (r.sent === 0) {
      throw new ApiError(`Kirim gagal via OneSignal (${r.lastError || 'no-subscription'}). Pastikan sudah Aktifkan push & beri izin notifikasi (bell OneSignal).`, 502)
    }
    return json({ ok: true, sent: r.sent, via: 'onesignal' })
  } catch (err) {
    if (err instanceof ApiError) throw err
    console.error('[pushSendSelf] onesignal', err)
    throw new ApiError(`Push OneSignal error: ${String(err?.message || err)}`, 502)
  }
}

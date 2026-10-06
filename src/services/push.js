// OneSignal only — VAPID lama dihapus
import { api } from './api'

function getOneSignal() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null)
    if (window.OneSignal && window.OneSignal.Notifications) {
      resolve(window.OneSignal)
      return
    }
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal) {
      resolve(OneSignal)
    })
    setTimeout(() => resolve(window.OneSignal || null), 3000)
  })
}

function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('hrms_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.sub || null
  } catch {
    return null
  }
}

export function pushSupported() {
  if (typeof window === 'undefined') return false
  if (window.OneSignalDeferred || window.OneSignal) return true
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getVapidPublicKey() { return null }
export function urlBase64ToUint8Array() { return new Uint8Array() }

export async function enablePush() {
  const OneSignal = await getOneSignal()
  if (!OneSignal || !OneSignal.Notifications) return { status: 'unsupported' }
  try {
    if (!OneSignal.Notifications.permission) {
      await OneSignal.Notifications.requestPermission()
    }
    if (!OneSignal.Notifications.permission) {
      const native = OneSignal.Notifications.permissionNative
      if (native === 'denied') return { status: 'denied' }
      return { status: 'default' }
    }
    const userId = getUserIdFromToken()
    if (userId) {
      try {
        await OneSignal.login(userId)
      } catch (e) {
        const msg = String(e?.message || '')
        if (msg.includes('409') || String(e?.status) === '409') {
          try { await OneSignal.logout() } catch {}
          await new Promise((r) => setTimeout(r, 600))
          try { await OneSignal.login(userId) } catch {}
        }
      }
      try { await OneSignal.User.addAlias('external_id', userId) } catch {}
    }
    try { await OneSignal.User.PushSubscription.optIn() } catch {}
    try {
      let subId = OneSignal.User.PushSubscription.id
      for (let i = 0; i < 6 && !subId; i++) {
        await new Promise((r) => setTimeout(r, 500))
        subId = OneSignal.User.PushSubscription.id
      }
      if (subId) {
        await api('/push/subscribe', { method: 'POST', body: { endpoint: subId, keys: { p256dh: 'onesignal', auth: 'onesignal' } } })
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
    return { status: 'granted' }
  } catch (e) {
    console.warn('[OneSignal] enable failed', e)
    return { status: 'default' }
  }
}

export async function disablePush() {
  let onesignalId = null
  try {
    const OneSignal = await getOneSignal()
    if (OneSignal?.User?.PushSubscription) {
      onesignalId = OneSignal.User.PushSubscription.id
      try { await OneSignal.User.PushSubscription.optOut() } catch {}
      try { await OneSignal.logout() } catch {}
    }
  } catch {}
  if (onesignalId) {
    try { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: onesignalId } }) } catch {}
  }
  try { await api('/push/unsubscribe', { method: 'POST', body: {} }) } catch {}
}

export async function getPushSubscription() {
  try {
    const OneSignal = await getOneSignal()
    if (!OneSignal?.User?.PushSubscription) return null
    const optedIn = OneSignal.User.PushSubscription.optedIn
    const id = OneSignal.User.PushSubscription.id
    if (optedIn || id) return { id: id || 'onesignal', optedIn: !!optedIn }
  } catch {}
  return null
}

export function testPush(title, body) {
  return api('/push/send', { method: 'POST', body: { title, body } })
}

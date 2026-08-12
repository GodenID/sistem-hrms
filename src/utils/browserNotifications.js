// ============================================================
// Browser Notifications utility
// ============================================================
// Wrapper tipis di atas Notification API browser. Dipakai oleh
// NotificationsContext untuk tampilkan notifikasi OS-level ketika
// tab HRMS sedang di background (document.hidden === true) dan user
// telah memberi izin.
//
// Catatan: ini BUKAN true Web Push (butuh backend + service worker).
// Untuk HRMS frontend-only, pola ini cukup untuk membuat notifikasi
// terasa "real-time" selama tab tetap terbuka di browser.
// ============================================================

// Apakah browser mendukung Notification API?
export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

// Status izin saat ini: 'default' | 'granted' | 'denied' | 'unsupported'
export function getPermissionStatus() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission
}

// Minta izin ke user. Return promise yang resolve ke status izin final.
// - 'default'  → user dismiss dialog tanpa memilih
// - 'granted'  → user mengizinkan
// - 'denied'   → user menolak (biasanya permanen sampai reset manual)
export async function requestPermission() {
  if (!isSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    // Browser lama yang masih callback-based
    return await new Promise((resolve) => {
      try {
        Notification.requestPermission(resolve)
      } catch {
        resolve('denied')
      }
    })
  }
}

// Tampilkan notifikasi browser. Return Notification instance atau null.
//
// Params:
//  - title     : judul notifikasi (wajib)
//  - body      : isi tambahan (opsional)
//  - tag       : id unik untuk replace notifikasi serupa (mis. 'pengajuan:abc')
//  - icon      : URL ikon (opsional)
//  - onClick   : handler saat user klik notifikasi (opsional)
//  - silent    : tidak bunyi (opsional)
//  - timeoutMs : auto-close setelah N ms (default 8000)
export function showNotification({
  title,
  body = '',
  tag = null,
  icon = null,
  onClick = null,
  silent = false,
  timeoutMs = 8000,
} = {}) {
  if (!isSupported()) return null
  if (Notification.permission !== 'granted') return null
  if (!title) return null

  try {
    const opts = {
      body,
      tag,
      icon: icon || '/vite.svg',
      badge: '/vite.svg',
      silent,
      requireInteraction: false,
    }
    const n = new Notification(title, opts)

    if (typeof onClick === 'function') {
      n.onclick = (ev) => {
        ev.preventDefault()
        try {
          window.focus()
        } catch {
          // ignore
        }
        onClick(ev)
        n.close()
      }
    }

    // Auto-close setelah timeout agar tidak menumpuk di notification tray
    if (timeoutMs > 0) {
      setTimeout(() => {
        try {
          n.close()
        } catch {
          // ignore
        }
      }, timeoutMs)
    }

    return n
  } catch (err) {
    // Beberapa browser melempar error jika dipanggil dari insecure context
    console.warn('[browserNotifications] showNotification failed:', err)
    return null
  }
}

// Helper: apakah tab HRMS sedang tidak terlihat (user di tab lain / minimized).
// Dipakai untuk memutuskan apakah perlu munculkan notifikasi OS-level.
export function isDocumentHidden() {
  if (typeof document === 'undefined') return false
  return document.hidden || document.visibilityState === 'hidden'
}

// Key untuk localStorage flag preferensi user (di SettingsPage).
export const PREF_STORAGE_KEY = 'hrms_browser_notif_pref'

// OneSignal + PWA precache — hanya OneSignal, VAPID lama dihapus
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Fallback global jika fetch gagal (offline / Cloudflare Access 401) — jangan throw "Failed to fetch" ke console
if (workbox.routing) {
  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      const cached = await caches.match('/index.html')
      return cached || Response.error()
    }
    return Response.error()
  })
}

// Jangan intercept /api/* — biar langsung ke network (Pages Functions), kalau gagal jangan cache error
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // Abaikan api, OneSignal, dan workbox cdn
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onesignal.com') || url.hostname.includes('workbox-cdn')) return
  if (request.mode === 'navigate' && request.method === 'GET') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/index.html')
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' })
      })
    )
  }
})

// Tangani promise rejection biar tidak muncul "Uncaught (in promise) TypeError: Failed to fetch" di console
self.addEventListener('unhandledrejection', (event) => {
  // cukup cegah bubble ke console, workbox sudah handle fallback
  event.preventDefault()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Klaim klien langsung biar update SW cepat
  event.waitUntil(self.clients.claim())
})

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

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung browser ini.'))
      return
    }
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let msg = {
          [err.PERMISSION_DENIED]: isPWA
            ? 'Akses lokasi ditolak di PWA. Tap Coba Lagi → Izinkan. Jika tetap ditolak: Android → tahan ikon HRMS → Info Aplikasi → Izin → Lokasi → Izinkan. iPhone → Hapus PWA, buka di Safari → Share → Add to Home Screen lagi.'
            : 'Akses lokasi ditolak. Izinkan akses lokasi di browser (ikon gembok di address bar → Izin lokasi).',
          [err.POSITION_UNAVAILABLE]: 'Lokasi tidak tersedia. Pastikan GPS aktif dan coba di luar ruangan.',
          [err.TIMEOUT]: 'Waktu permintaan lokasi habis. Coba lagi.',
        }[err.code] || 'Gagal mendapatkan lokasi.'
        // Tambah hint PWA jika memang standalone tapi bukan permission_denied
        if (isPWA && err.code !== err.PERMISSION_DENIED) {
          msg += ' (PWA: pastikan GPS aktif)'
        }
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0, ...options },
    )
  })
}

export async function hardRefreshPWA() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {}
  window.location.reload()
}

export function findNearestLocation(userLat, userLng, locations) {
  let nearest = null
  let minDist = Infinity
  for (const loc of locations) {
    const d = haversine(userLat, userLng, loc.lat, loc.lng)
    if (d < minDist) {
      minDist = d
      nearest = { ...loc, distance: Math.round(d) }
    }
  }
  return nearest
}

export function isWithinRadius(userLat, userLng, location) {
  const d = haversine(userLat, userLng, location.lat, location.lng)
  return d <= (location.radius || 100)
}

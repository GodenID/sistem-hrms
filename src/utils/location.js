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
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const msg = {
          [err.PERMISSION_DENIED]: 'Akses lokasi ditolak. Izinkan akses lokasi di browser.',
          [err.POSITION_UNAVAILABLE]: 'Lokasi tidak tersedia.',
          [err.TIMEOUT]: 'Waktu permintaan lokasi habis.',
        }[err.code] || 'Gagal mendapatkan lokasi.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: 10000, ...options },
    )
  })
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

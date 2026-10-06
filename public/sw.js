// Legacy sw.js — dulu dipakai sebelum OneSignalSDKWorker.js
// Sekarang PWA pakai /OneSignalSDKWorker.js. File ini cuma untuk
// membersihkan registrasi lama yang masih nempel di browser user.
// Begitu di-load, langsung unregister dirinya sendiri.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => {
    return self.clients.matchAll({ type: 'window' })
  }).then((clients) => {
    clients.forEach((c) => c.navigate(c.url))
  })
})

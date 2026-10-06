import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// build 2026-08-20 — cache headers: assets no-cache (self-healing)
console.debug('[hrms] build 2026-08-20 — assets no-cache')
// Hilangkan log Workbox yang mengganggu: "[WM] No SW registration for postMessage"
;(() => {
  const shouldIgnore = (args) => typeof args[0] === 'string' && args[0].includes('No SW registration for postMessage')
  for (const m of ['warn', 'log', 'debug']) {
    const orig = console[m].bind(console)
    console[m] = (...args) => { if (shouldIgnore(args)) return; orig(...args) }
  }
})()
// Bersihkan registrasi lama /sw.js (dulu sebelum pakai OneSignalSDKWorker.js)
// - sw.js lama masih ke-cache di browser user dan bikin "Failed to fetch" di console
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) {
      const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || ''
      if (url.includes('/sw.js')) {
        r.unregister().then((ok) => ok && console.debug('[hrms] unregistered old sw.js', url))
      }
    }
  })
  // Cegah log "Uncaught (in promise) TypeError: Failed to fetch" dari workbox yang bubble ke window
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e.reason?.message || e.reason || '')
    if (msg.includes('Failed to fetch')) e.preventDefault()
  })
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

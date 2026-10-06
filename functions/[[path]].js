// ============================================================
// HRMS API — root catch-all (Cloudflare Pages Functions).
// HANYA melayani /health di root. API lengkap diekspos via
// /api/* (functions/api/[[path]].js). Path SPA yang tidak cocok
// dengan route mana pun → fallback ke static assets (halaman SPA).
// JANGAN pakai tabel ROUTES penuh di sini: path SPA seperti
// /pengajuan atau /events akan cocok dengan route API (butuh auth)
// sehingga refresh halaman malah mengembalikan 401 JSON.
// ============================================================

import { createApi, ROOT_ROUTES } from './lib/router.js'

export const onRequest = createApi({ routes: ROOT_ROUTES, assetsFallback: true })
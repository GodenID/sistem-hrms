// ============================================================
// HRMS API — kompatibilitas/dev: file ini TIDAK di-deploy.
// Versi yang aktif adalah functions/api/[[path]].js dan
// functions/[[path]].js; keduanya memakai router yang sama dari
// functions/lib/router.js (satu sumber kebenaran).
// ============================================================

import { createApi } from './functions/lib/router.js'

export const onRequest = createApi()
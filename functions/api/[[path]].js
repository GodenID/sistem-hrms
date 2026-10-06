// ============================================================
// HRMS API — Cloudflare Pages Functions (Worker)
// Wrapper tipis: seluruh logika ada di functions/lib/router.js
// (satu sumber kebenaran — tidak ada lagi salinan API terpisah).
// Port dari backend Express lama. Semua akses DB via PostgREST
// memakai anon key dari env worker (tidak pernah di bundle).
// ============================================================

import { createApi } from '../lib/router.js'

export const onRequest = createApi()
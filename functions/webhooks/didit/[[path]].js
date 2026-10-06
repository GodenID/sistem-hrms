// ============================================================
// Webhook Didit — menerima hasil verifikasi (status.updated, dll)
// Endpoint publik: POST /webhooks/didit/
//
// Keamanan (sesuai docs.didit.me/integration/webhooks):
//   - X-Signature-V2: HMAC-SHA256 hex dari kanonikalisasi JSON
//     (sortKeys + shortenFloats + compact + unicode preserved),
//     diverifikasi constant-time via Web Crypto.
//   - Fallback X-Signature-Simple: HMAC dari "{ts}:{sid}:{status}:{type}".
//   - X-Timestamp: tolak bila selisih > 300 detik (anti replay).
//   - Idempotensi: event_id reusable saat retry — dicek sebelum insert.
//
// Tidak ada rahasia di file ini; semuanya dari env Pages:
//   DIDIT_WEBHOOK_SECRET (secret penandatangan webhook)
//   SUPABASE_URL / SUPABASE_ANON_KEY (simpan event ke tabel didit_webhooks)
// ============================================================

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
}

function hexToBytes(hex) {
  const clean = String(hex).replace(/[^0-9a-fA-F]/g, '')
  if (clean.length === 0 || clean.length % 2 !== 0) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

function shortenFloats(v) {
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.map(shortenFloats)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) o[k] = shortenFloats(v[k])
    return o
  }
  return v
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k])
    return o
  }
  return v
}

// Kanonikalisasi V2: normalisasi angka bulat → sort key rekursif → JSON compact (unicode preserved).
function canonicalV2(body) {
  return JSON.stringify(sortKeys(shortenFloats(JSON.parse(body))))
}

async function verifyV2(bodyText, signature, secret) {
  const expected = await hmacKey(secret).then((key) =>
    crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature),
      new TextEncoder().encode(canonicalV2(bodyText))
    )
  )
  return expected
}

async function verifySimple(payload, signature, secret) {
  const str = `${payload.timestamp}:${payload.session_id}:${payload.status}:${payload.webhook_type}`
  return hmacKey(secret).then((key) =>
    crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature),
      new TextEncoder().encode(str)
    )
  )
}

// ---------- Simpan event (idempotent) ke tabel didit_webhooks ----------

async function pgReq(env, path, init = {}) {
  const base = (env.SUPABASE_URL || '').replace(/\/+$/, '')
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method: init.method || 'GET',
    headers: {
      apikey: env.SUPABASE_ANON_KEY || '',
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY || ''}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function persistEvent(env, payload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return
  const { event_id, webhook_type, session_id, status, environment, workflow_id, vendor_data } = payload
  const exists = await pgReq(env, `didit_webhooks?select=event_id&event_id=eq.${encodeURIComponent(event_id)}`)
  if (Array.isArray(exists) && exists.length > 0) return
  await pgReq(
    env,
    'didit_webhooks?select=event_id',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        event_id: String(event_id || '').slice(0, 64),
        webhook_type: String(webhook_type || 'unknown'),
        session_id: session_id ? String(session_id).slice(0, 64) : null,
        status: status ? String(status).slice(0, 64) : null,
        environment: environment ? String(environment).slice(0, 32) : null,
        workflow_id: workflow_id ? String(workflow_id).slice(0, 64) : null,
        vendor_data: vendor_data ? String(vendor_data).slice(0, 128) : null,
        payload,
      },
    }
  )
}

// Setelah verifikasi sukses, tandai user yang KTP-nya cocok sebagai terverifikasi.
// NIK hasil OCR (identification_number) dicocokkan ke kolom users.ktp.
async function markUserVerifiedByNik(env, payload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return
  const decision = payload?.decision && typeof payload?.decision === 'object' ? payload.decision : payload
  const idVer = Array.isArray(decision?.id_verifications) ? decision.id_verifications[0] : null
  if (!idVer) return

  const status = String(idVer.status || decision.status || '').toLowerCase()
  if (!['approved', 'verified', 'complete', 'completed'].includes(status)) return

  const fields = idVer.extracted_fields || idVer.fields || idVer.data || {}
  const nik = String(
    fields.identification_number ||
      fields.nik ||
      fields.document_number ||
      idVer.identification_number ||
      idVer.document_number ||
      ''
  ).replace(/\D/g, '')
  if (nik.length < 15) return

  await pgReq(env, `users?ktp=eq.${encodeURIComponent(nik)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: { ktp_verified: true },
  })
}

// ---------- Handler ----------

export async function onRequest(context) {
  const { request, env } = context

  // Ping verifikasi kepemilikan URL dari console Didit (echo verification code).
  const url = new URL(request.url)
  const qCode = url.searchParams.get('code')
  if (request.method === 'GET' && qCode) {
    return new Response(JSON.stringify({ code: qCode }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const secret = env.DIDIT_WEBHOOK_SECRET
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Webhook secret belum dikonfigurasi' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const signatureV2 = request.headers.get('X-Signature-V2')
  const signatureSimple = request.headers.get('X-Signature-Simple')
  const timestampHeader = request.headers.get('X-Timestamp')

  const bodyText = await request.text()
  let payload = null
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return new Response(JSON.stringify({ error: 'Body bukan JSON valid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Echo verification code bila dikirim sebagai body (pola console Didit).
  if (typeof payload?.code === 'string' && payload.code.length > 0) {
    return new Response(JSON.stringify({ code: payload.code }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (timestampHeader) {
    const ts = Number(timestampHeader)
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return new Response(JSON.stringify({ error: 'Timestamp kedaluwarsa' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  let verified = false
  try {
    if (signatureV2 && (await verifyV2(bodyText, signatureV2, secret))) verified = true
    else if (signatureSimple && (await verifySimple(payload, signatureSimple, secret))) verified = true
  } catch {
    verified = false
  }

  if (!verified) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Balas cepat (timeout delivery Didit 5 detik), simpan async tanpa menunggu.
  await persistEvent(env, payload).catch(() => {})
  await markUserVerifiedByNik(env, payload).catch(() => {})

  return new Response(JSON.stringify({ ok: true, received: payload.event_id || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

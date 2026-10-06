// ============================================================
// Webhook Didit — port dari functions/webhooks/didit/[[path]].js
// untuk server Node. Verifikasi signature IDENTIK (Web Crypto ada
// di Node 20+). Penyimpanan via core-pg (Postgres langsung).
// ============================================================

import { selectRows, insertRow, updateRows } from './core-pg.js'

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

async function persistEvent(env, payload) {
  if (!env.DATABASE_URL) return
  const { event_id, webhook_type, session_id, status, environment, workflow_id, vendor_data } =
    payload
  const exists = await selectRows(env, 'didit_webhooks', {
    select: 'event_id',
    filter: [{ col: 'event_id', value: event_id }],
  })
  if (exists.length > 0) return
  await insertRow(env, 'didit_webhooks', {
    event_id: String(event_id || '').slice(0, 64),
    webhook_type: String(webhook_type || 'unknown'),
    session_id: session_id ? String(session_id).slice(0, 64) : null,
    status: status ? String(status).slice(0, 64) : null,
    environment: environment ? String(environment).slice(0, 32) : null,
    workflow_id: workflow_id ? String(workflow_id).slice(0, 64) : null,
    vendor_data: vendor_data ? String(vendor_data).slice(0, 128) : null,
    payload,
  })
}

async function markUserVerifiedByNik(env, payload) {
  if (!env.DATABASE_URL) return
  const decision =
    payload?.decision && typeof payload?.decision === 'object' ? payload.decision : payload
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

  await updateRows(env, 'users', [{ col: 'ktp', value: nik }], { ktp_verified: true })
}

export async function onRequest(context) {
  const { request, env } = context

  const url = new URL(request.url)
  const qCode = url.searchParams.get('code')
  if (request.method === 'GET' && qCode) {
    return Response.json({ code: qCode })
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const secret = env.DIDIT_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook secret belum dikonfigurasi' }, { status: 503 })
  }

  const signatureV2 = request.headers.get('X-Signature-V2')
  const signatureSimple = request.headers.get('X-Signature-Simple')
  const timestampHeader = request.headers.get('X-Timestamp')

  const bodyText = await request.text()
  let payload = null
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return Response.json({ error: 'Body bukan JSON valid' }, { status: 400 })
  }

  if (typeof payload?.code === 'string' && payload.code.length > 0) {
    return Response.json({ code: payload.code })
  }

  if (timestampHeader) {
    const ts = Number(timestampHeader)
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return Response.json({ error: 'Timestamp kedaluwarsa' }, { status: 401 })
    }
  }

  let verified = false
  try {
    if (signatureV2 && (await verifyV2(bodyText, signatureV2, secret))) verified = true
    else if (signatureSimple && (await verifySimple(payload, signatureSimple, secret)))
      verified = true
  } catch {
    verified = false
  }

  if (!verified) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  await persistEvent(env, payload).catch(() => {})
  await markUserVerifiedByNik(env, payload).catch(() => {})

  return Response.json({ ok: true, received: payload.event_id || null })
}

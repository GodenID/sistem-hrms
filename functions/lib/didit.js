import * as core from './core.js'
const { ApiError, json } = core
// ---------- Didit OCR proxy (server-side, menghindari CORS + key tidak di bundle) ----------

async function diditProxy(context) {
  const { request, env } = context
  const key = env.DIDIT_API_KEY
  if (!key || !String(key).trim()) {
    throw new ApiError('Didit API key belum dikonfigurasi di server', 503)
  }
  let form
  try {
    form = await request.formData()
  } catch {
    throw new ApiError('Body harus multipart/form-data (front_image)', 400)
  }
  const res = await fetch('https://verification.didit.me/v3/id-verification/', {
    method: 'POST',
    headers: { 'x-api-key': String(key).trim() },
    body: form,
  })
  const text = await res.text().catch(() => '')
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || data?.error || text.slice(0, 300) || 'respons tidak valid.'
    throw new ApiError(`Didit OCR gagal (${res.status}): ${detail}`, res.status)
  }
  return json(data || {})
}

// ---------- Didit session (alur gratis: workflow + webhook) ----------

async function diditDiditFetch(context, path, init = {}) {
  const key = context.env.DIDIT_API_KEY
  if (!key || !String(key).trim()) {
    throw new ApiError('Didit API key belum dikonfigurasi di server', 503)
  }
  const res = await fetch(`https://verification.didit.me${path}`, {
    ...init,
    headers: { 'x-api-key': String(key).trim(), ...(init.headers || {}) },
  })
  const text = await res.text().catch(() => '')
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || data?.error || text.slice(0, 300) || 'respons tidak valid.'
    throw new ApiError(`${detail}`, res.status)
  }
  return data
}

async function diditCreateSession(context) {
  const workflowId = context.env.DIDIT_WORKFLOW_ID
  if (!workflowId || !String(workflowId).trim()) {
    throw new ApiError('DIDIT_WORKFLOW_ID belum dikonfigurasi di server', 503)
  }
  const body = await context.request.json().catch(() => ({}))
  const data = await diditDiditFetch(context, '/v3/session/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: String(workflowId).trim(),
      vendor_data: String(body.vendorData || `register-${Date.now()}`).slice(0, 128),
    }),
  })
  if (!data?.url) throw new ApiError('Sesi dibuat tanpa URL verifikasi', 502)
  return json({
    sessionId: data.session_id || data.id || null,
    url: data.url,
    status: data.status || 'created',
  })
}

async function diditDecision(context, query) {
  const sessionId = String(query.sessionId || '').trim()
  if (!sessionId) throw new ApiError('sessionId wajib diisi', 400)
  const data = await diditDiditFetch(
    context,
    `/v3/session/${encodeURIComponent(sessionId)}/decision/`
  )
  return json(data)
}


export { diditProxy, diditDiditFetch, diditCreateSession, diditDecision }


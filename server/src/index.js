// ============================================================
// HRMS API standalone — Node.js + Postgres (deploy: Coolify).
// Dispatcher memakai router hasil sync (server/src/gen/router.js)
// yang logikanya IDENTIK dengan Cloudflare Pages Functions.
// Jalankan `npm run sync` (otomatis via prestart) setiap kali
// functions/lib berubah sebelum start/deploy.
// ============================================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createApi } from './gen/router.js'
import { onRequest as diditWebhook } from './webhook-didit.js'

const app = new Hono()

const CORS_ORIGIN = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  '*',
  cors({
    origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

const api = createApi()

function cfContext(c, pathParts) {
  // Bentuk context yang sama persis dengan Pages Functions:
  // { request, env, params } — env diambil dari process.env.
  return { request: c.req.raw, env: process.env, params: { path: pathParts } }
}

function splitPath(raw) {
  return String(raw || '')
    .split('/')
    .filter(Boolean)
}

// Health tanpa prefix maupun dengan prefix /api.
app.all('/health', (c) => api(cfContext(c, ['health'])))
app.all('/api/health', (c) => api(cfContext(c, ['health'])))

// Semua endpoint API: /api/*  (kontrak JSON sama dengan Pages Functions)
app.all('/api/*', (c) => {
  const full = new URL(c.req.url).pathname.replace(/^\/api\/?/, '')
  return api(cfContext(c, splitPath(full)))
})

// Webhook Didit (publik, verifikasi signature internal).
app.all('/webhooks/didit', (c) =>
  diditWebhook({ request: c.req.raw, env: process.env })
)
app.all('/webhooks/didit/*', (c) =>
  diditWebhook({ request: c.req.raw, env: process.env })
)

app.get('/', (c) =>
  c.json({ status: 'ok', service: 'hrms-api', time: new Date().toISOString() })
)
app.notFound((c) => c.json({ error: 'Endpoint tidak ditemukan' }, 404))

const port = Number(process.env.PORT || 3000)
console.log(`[hrms-api] listening on :${port}`)

export default app

// Node standalone (bukan via @hono/node-server agar tanpa dep tambahan).
import http from 'node:http'

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue
      if (Array.isArray(v)) for (const x of v) headers.append(k, x)
      else headers.set(k, String(v))
    }
    const body = await new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (ch) => chunks.push(ch))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
    })
    const response = await app.fetch(request)
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf)
  } catch (err) {
    console.error('[hrms-api] fatal:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Terjadi kesalahan server' }))
  }
})

server.listen(port)

// Generate VAPID keypair EC P-256 (untuk Web Push RFC 8291).
// Output: PUSH_VAPID_JWK (paste ke Cloudflare Pages → Settings → Environment variables → Production).
// Node 24+ (global crypto.subtle).
const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

function b64u(buf) {
  return Buffer.from(buf).toString('base64url')
}

const x = Buffer.from(jwk.x, 'base64url')
const y = Buffer.from(jwk.y, 'base64url')
const publicPoint = Buffer.concat([Buffer.from([4]), x, y])

console.log('=== PUSH_VAPID_JWK (rahasia — paste ke env Cloudflare Pages) ===')
console.log(JSON.stringify({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }))
console.log('')
console.log('=== VAPID public key (untuk verifikasi frontend — TIDAK perlu disimpan) ===')
console.log(b64u(publicPoint))
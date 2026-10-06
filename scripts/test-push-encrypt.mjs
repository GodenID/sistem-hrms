// Uji round-trip enkripsi RFC 8291 (aes128gcm) — jalankan: node scripts/test-push-encrypt.mjs
import { encryptPayload } from '../functions/lib/push.js'

const TE = new TextEncoder()
const b64u = (buf) => Buffer.from(buf).toString('base64url')

// Simulasi subscription browser: client ECDH keypair + auth secret
const clientEcdh = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const clientPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', clientEcdh.publicKey)) // 65B
const clientJwk = await crypto.subtle.exportKey('jwk', clientEcdh.privateKey)
const authSecret = crypto.getRandomValues(new Uint8Array(16))

const payload = JSON.stringify({ title: 'Test', body: 'Halo', url: '/', tag: 'x' })
const body = await encryptPayload(b64u(clientPubRaw), b64u(authSecret), payload)

console.log('body length:', body.length, '(expect 65+16+4+enc)')

// ---- Dekripsi sisi "browser" mengikuti RFC 8291 ----
const ephPub = body.slice(0, 65)
const salt = body.slice(65, 81)
const rs = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(81)
const ciphertext = body.slice(85)
console.log('rs:', rs, '(expect 4096)')

const hkdf = async (ikm, saltB, info, length) => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: saltB, info }, key, length * 8)
  return new Uint8Array(bits)
}

const ephJwk = {
  kty: 'EC', crv: 'P-256',
  x: b64u(ephPub.slice(1, 33)),
  y: b64u(ephPub.slice(33, 65)),
}
const ephKey = await crypto.subtle.importKey('jwk', ephJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ephKey }, clientEcdh.privateKey, 256))

const authInfo = new Uint8Array(12 + 1 + 16 + 65 + 65)
authInfo.set(TE.encode('WebPush:info'), 0)
authInfo.set(authSecret, 13)
authInfo.set(clientPubRaw, 29)
authInfo.set(ephPub, 94)
const prk = await hkdf(shared, authInfo, TE.encode('auth'), 32)

const cekLabel = TE.encode('Content-Encoding: aes128gcm')
const nonceLabel = TE.encode('Content-Encoding: nonce')
const cekInfo = new Uint8Array(cekLabel.length + 1 + 65 + 65)
cekInfo.set(cekLabel, 0); cekInfo.set(clientPubRaw, cekLabel.length + 1); cekInfo.set(ephPub, cekLabel.length + 1 + 65)
const nonceInfo = new Uint8Array(nonceLabel.length + 1 + 65 + 65)
nonceInfo.set(nonceLabel, 0); nonceInfo.set(clientPubRaw, nonceLabel.length + 1); nonceInfo.set(ephPub, nonceLabel.length + 1 + 65)

const cek = await hkdf(prk, new Uint8Array(0), cekInfo, 16)
const nonce = await hkdf(prk, new Uint8Array(0), nonceInfo, 12)

const contentHeader = body.slice(0, 85)
const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt'])
const plain = new Uint8Array(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: contentHeader }, aesKey, ciphertext)
)

const result = new TextDecoder().decode(plain)
if (result === payload) {
  console.log('ROUND-TRIP OK — enkripsi RFC 8291 benar')
} else {
  console.log('FAIL — hasil dekripsi tidak cocok:', result)
  process.exit(1)
}
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// ---------- PNG encoder (minimal, RGBA) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---------- Drawing ----------
const INDIGO = [99, 102, 241] // #6366f1
const WHITE = [255, 255, 255]

// 'P' bitmap 5x7
const P_GLYPH = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
]

function roundedRect(size, radius, color, bg = null) {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
      const inside = dx * dx + dy * dy <= radius * radius
      if (bg) {
        buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; buf[i + 3] = 255
      }
      if (inside) {
        buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = 255
      }
    }
  }
  return buf
}

function drawGlyph(buf, size, glyph, scale, color) {
  const gw = glyph[0].length
  const gh = glyph.length
  const px = scale
  const w = gw * px
  const h = gh * px
  const offX = Math.floor((size - w) / 2)
  const offY = Math.floor((size - h) / 2)
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      if (!glyph[r][c]) continue
      for (let dy = 0; dy < px; dy++) {
        for (let dx = 0; dx < px; dx++) {
          const x = offX + c * px + dx
          const y = offY + r * px + dy
          if (x < 0 || y < 0 || x >= size || y >= size) continue
          const i = (y * size + x) * 4
          buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = 255
        }
      }
    }
  }
  return buf
}

function makeIcon(size, { rounded = false, fullBleed = false, glyphScale = 0.42 } = {}) {
  let buf
  if (fullBleed) {
    buf = roundedRect(size, 0, INDIGO, INDIGO) // solid full-bleed indigo
  } else if (rounded) {
    buf = roundedRect(size, Math.round(size * 0.22), INDIGO) // rounded square, transparent outside
  } else {
    // circle on transparent
    buf = Buffer.alloc(size * size * 4)
    const r = size / 2 - 1
    const cx = size / 2
    const cy = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        if (dx * dx + dy * dy <= r * r) {
          const i = (y * size + x) * 4
          buf[i] = INDIGO[0]; buf[i + 1] = INDIGO[1]; buf[i + 2] = INDIGO[2]; buf[i + 3] = 255
        }
      }
    }
  }
  const cell = Math.max(1, Math.floor((size * glyphScale) / 5))
  drawGlyph(buf, size, P_GLYPH, cell, WHITE)
  return buf
}

const sizes = [
  { file: 'icon-192.png', size: 192, opts: { rounded: true } },
  { file: 'icon-512.png', size: 512, opts: { rounded: true } },
  { file: 'icon-maskable-192.png', size: 192, opts: { fullBleed: true, glyphScale: 0.34 } },
  { file: 'icon-maskable-512.png', size: 512, opts: { fullBleed: true, glyphScale: 0.34 } },
  { file: 'apple-touch-icon.png', size: 180, opts: { fullBleed: true, glyphScale: 0.42 } },
  { file: 'favicon-32.png', size: 32, opts: { rounded: true } },
]

for (const { file, size, opts } of sizes) {
  const buf = makeIcon(size, opts)
  writeFileSync(join(outDir, file), encodePng(size, size, buf))
  console.log('generated', file)
}
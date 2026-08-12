// Layanan OCR KTP via Didit.me
// ============================================================
// Dua mode operasi:
//   1. REAL mode:  aktif bila env var VITE_DIDIT_API_KEY di-set.
//                  Panggil POST https://verification.didit.me/v3/id-verification/
//                  dengan header x-api-key. Endpoint ini menerima multipart/form-data
//                  (front_image = foto KTP) dan mengembalikan field identitas hasil OCR.
//                  ⚠️ Karena project ini murni client-side (tanpa backend), API key
//                  akan terekspos di bundle. Untuk produksi, panggil endpoint ini dari
//                  server-side proxy Anda, BUKAN langsung dari browser.
//   2. DEMO mode:  fallback bila VITE_DIDIT_API_KEY tidak di-set. Mensimulasikan
//                  panggilan OCR dengan delay + data KTP realistis (acak) supaya
//                  halaman register bisa diuji end-to-end tanpa kunci API.
//
// Referensi Didit.me:
//   - https://docs.didit.me/standalone-apis/id-verification
//   - https://docs.didit.me/core-technology/id-verification/overview
// ============================================================

const DIDIT_ENDPOINT = 'https://verification.didit.me/v3/id-verification/'

function getApiKey() {
  // Vite inject env var ber-prefix VITE_ ke import.meta.env saat build.
  const key = import.meta.env?.VITE_DIDIT_API_KEY
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null
}

export function isDiditRealMode() {
  return Boolean(getApiKey())
}

// Pemetaan respons Didit → shape internal kita.
// Field Indonesian KTP dari Didit: full_name, date_of_birth, place_of_birth,
// nationality, sex, address, identification_number (NIK), document_type, dll.
function mapDiditResponse(json) {
  // Standalone OCR mengembalikan object id_verification (singular)
  const doc = json?.id_verification || json?.data?.id_verification || json
  const status = (json?.status || doc?.status || 'Approved').toString()
  const fields = doc?.extracted_fields || doc?.fields || doc?.data?.fields || {}

  const pickStr = (...vals) => {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (v && typeof v === 'object' && typeof v.value === 'string' && v.value.trim()) {
        return v.value.trim()
      }
    }
    return ''
  }

  const fullName =
    pickStr(fields.full_name, fields.name, doc?.full_name, doc?.holder_name) || ''
  const nik =
    pickStr(
      fields.identification_number,
      fields.nik,
      fields.document_number,
      doc?.identification_number,
      doc?.document_number,
    ).replace(/\D/g, '')
  const placeOfBirth =
    pickStr(fields.place_of_birth, fields.birth_place, doc?.place_of_birth) || ''
  const dateOfBirth =
    pickStr(fields.date_of_birth, fields.birth_date, doc?.date_of_birth) || ''
  const sex =
    pickStr(fields.sex, fields.gender, doc?.sex, doc?.gender).toUpperCase() || ''
  const address =
    pickStr(fields.address, fields.full_address, doc?.address, doc?.full_address) || ''
  const documentType = pickStr(fields.document_type, doc?.document_type) || 'IDN_KTP'

  return {
    status,
    documentType,
    fullName,
    nik,
    placeOfBirth,
    dateOfBirth,
    sex,
    address,
    warnings: Array.isArray(doc?.warnings) ? doc.warnings : [],
    raw: json,
  }
}

// Hasil simulasi OCR untuk mode demo.
// Mengambil nama file sebagai seed agar hasil deterministik per upload,
// sehingga developer bisa menguji "upload ulang dapat data sama".
function buildDemoResult(file) {
  const seedSource = (file?.name || 'demo-ktp') + (file?.size || 0)
  let seed = 0
  for (let i = 0; i < seedSource.length; i++) seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0

  const firstNames = ['Budi', 'Sari', 'Andi', 'Dewi', 'Putri', 'Agus', 'Rina', 'Eko', 'Fitri', 'Hadi']
  const middleNames = ['Kusuma', 'Wijaya', 'Pratama', 'Lestari', 'Nugroho', 'Saputra', 'Anggraini']
  const lastNames = ['Santoso', 'Wibowo', 'Setiawan', 'Suharto', 'Handayani', 'Permadi', 'Maulana']
  const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Medan', 'Makassar']
  const streets = ['Jl. Merdeka', 'Jl. Sudirman', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Gatot Subroto']

  const pick = (arr) => arr[seed % arr.length]
  const pickN = (arr, n) => {
    let s = seed >>> 1
    const out = []
    for (let i = 0; i < n && arr.length > 0; i++) {
      s = (s * 1103515245 + 12345) >>> 0
      out.push(arr[s % arr.length])
    }
    return out.join(' ')
  }

  const fullName = `${pickN(firstNames, 1)} ${pick(middleNames)} ${pick(lastNames)}`
  const nik = String(((seed * 9301 + 49297) % 9_000_000_000_000_000) + 1_000_000_000_000_000).slice(-16)
  const birthYear = 1965 + (seed % 35)
  const birthMonth = ((seed >>> 3) % 12) + 1
  const birthDay = ((seed >>> 7) % 27) + 1
  const dateOfBirth = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
  const placeOfBirth = pick(cities)
  const sex = seed % 2 === 0 ? 'M' : 'F'
  const address = `${pick(streets)} No. ${(seed >>> 5) % 200 + 1}, ${pick(cities)}`

  return {
    status: 'Approved',
    documentType: 'idn_residential_identity_card',
    fullName,
    nik,
    placeOfBirth,
    dateOfBirth,
    sex,
    address,
    warnings: [],
    raw: null,
    demo: true,
  }
}

// Validasi input file: harus gambar / PDF dan tidak lebih besar dari 10 MB.
export function validateKtpFile(file) {
  if (!file) return { ok: false, error: 'File KTP belum dipilih.' }
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf']
  if (!allowed.includes(file.type)) {
    return { ok: false, error: 'Format file harus JPG, PNG, WEBP, TIFF, atau PDF.' }
  }
  const max = 10 * 1024 * 1024
  if (file.size > max) {
    return { ok: false, error: 'Ukuran file maksimal 10 MB.' }
  }
  return { ok: true }
}

// Baca file → DataURL (untuk preview di <img>).
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca file.'))
    reader.readAsDataURL(file)
  })
}

// Entry point utama: jalankan OCR KTP terhadap file yang di-upload.
// Mengembalikan { status, fullName, nik, placeOfBirth, dateOfBirth, sex, address, warnings, demo }.
export async function scanKtp(file, { signal } = {}) {
  const key = getApiKey()
  if (!key) {
    // Mode demo: simulasi panggilan jaringan 1.2-2 detik agar UX terasa realistis.
    await new Promise((res) => setTimeout(res, 1200 + Math.random() * 800))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return buildDemoResult(file)
  }

  // Mode real: panggil endpoint standalone ID verification.
  const form = new FormData()
  form.append('front_image', file)
  form.append('vendor_data', `register-${Date.now()}`)
  form.append('consent', 'true')

  const res = await fetch(DIDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'x-api-key': key },
    body: form,
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.detail || errBody?.message || JSON.stringify(errBody)
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(
      `Didit OCR gagal (${res.status}): ${detail || 'respons tidak valid.'}`,
    )
  }

  const json = await res.json()
  const mapped = mapDiditResponse(json)

  // Status "Declined" tetap dikembalikan (bukan throw) agar caller bisa menampilkan
  // peringatan spesifik (mis. dokumen tidak terbaca) alih-alih error jaringan generik.
  return mapped
}

// Format tanggal hasil OCR (YYYY-MM-DD atau DD-MM-YYYY) → YYYY-MM-DD untuk <input type="date">.
export function normalizeDateOfBirth(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  // Sudah ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // Format Indonesia DD-MM-YYYY atau DD/MM/YYYY
  const m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // Coba parse Date
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return ''
}

// Normalisasi jenis kelamin ke kode internal: 'M' / 'F' / ''.
export function normalizeSex(value) {
  if (!value) return ''
  const v = String(value).trim().toUpperCase()
  if (!v) return ''
  if (['M', 'MALE', 'LAKI-LAKI', 'LAKI'].includes(v)) return 'M'
  if (['F', 'FEMALE', 'PEREMPUAN', 'WANITA'].includes(v)) return 'F'
  return ''
}

// Tampilkan jenis kelamin dalam bahasa Indonesia.
export function sexLabel(code) {
  return code === 'M' ? 'Laki-laki' : code === 'F' ? 'Perempuan' : '—'
}

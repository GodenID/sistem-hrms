// Layanan OCR KTP via Didit.me
// ============================================================
// Semua panggilan ke Didit dilakukan lewat proxy server-side
// (Pages Functions: POST /api/didit/verify). Browser tidak pernah
// menyentuh verification.didit.me langsung, sehingga tidak ada
// masalah CORS dan API key tidak pernah berada di bundle.
//
//   REAL mode: worker punya env DIDIT_API_KEY (Pages secret).
//              Worker meneruskan multipart/form-data
//              (front_image = foto KTP) ke Didit dengan header
//              x-api-key, lalu mengembalikan hasil OCR.
//
// Referensi Didit.me:
//   - https://docs.didit.me/standalone-apis/id-verification
//   - https://docs.didit.me/core-technology/id-verification/overview
// ============================================================

const DIDIT_PROXY = '/api/didit/verify'

// Buat sesi verifikasi baru (workflow Didit). Mengembalikan
// { sessionId, url, status } — user menyelesaikan verifikasi di `url`,
// hasilnya dikirim ke webhook kita dan dibaca lewat getDiditDecision().
export async function createDiditSession(vendorData) {
  const res = await fetch('/api/didit/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorData }),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(j?.error || `Gagal membuat sesi verifikasi (${res.status}).`)
  }
  return { sessionId: j?.sessionId ?? null, url: j?.url ?? null, status: j?.status ?? 'created' }
}

// Ambil hasil (decision) sesi verifikasi dari worker.
export async function getDiditDecision(sessionId) {
  const res = await fetch(`/api/didit/decision?sessionId=${encodeURIComponent(sessionId)}`)
  const j = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(j?.error || `Gagal mengambil hasil verifikasi (${res.status}).`)
  }
  return j
}

// Pemetaan respons Didit → shape internal kita.
// Field Indonesian KTP dari Didit: full_name, date_of_birth, place_of_birth,
// nationality, sex, address, identification_number (NIK), document_type, dll.
function pickStr(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v && typeof v === 'object' && typeof v.value === 'string' && v.value.trim()) {
      return v.value.trim()
    }
  }
  return ''
}

function mapDiditResponse(json) {
  // Standalone OCR mengembalikan object id_verification (singular)
  const doc = json?.id_verification || json?.data?.id_verification || json
  const status = (json?.status || doc?.status || 'Approved').toString()
  const fields = doc?.extracted_fields || doc?.fields || doc?.data?.fields || {}

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

// Ekstrak hasil verifikasi dari decision sesi (kontrak V3: array plural).
// `body` bisa berupa object decision langsung atau envelope webhook/API.
export function extractDiditVerification(body) {
  const decision =
    body && typeof body === 'object' && body.decision && typeof body.decision === 'object'
      ? body.decision
      : body
  const idVer = Array.isArray(decision?.id_verifications) ? decision.id_verifications[0] : null
  if (!idVer) return mapDiditResponse(body)
  const src = idVer.extracted_fields || idVer.fields || idVer.data || {}
  return {
    status: String(idVer.status || decision.status || ''),
    documentType: String(idVer.document_type || ''),
    fullName: pickStr(src.full_name, src.name, idVer.full_name, idVer.name),
    nik: pickStr(
      src.identification_number,
      src.document_number,
      idVer.identification_number,
      idVer.document_number,
    ).replace(/\D/g, ''),
    placeOfBirth: pickStr(src.place_of_birth, idVer.place_of_birth),
    dateOfBirth: pickStr(src.date_of_birth, idVer.date_of_birth),
    sex: pickStr(src.sex, idVer.sex).toUpperCase(),
    address: pickStr(src.address, idVer.address),
    warnings: Array.isArray(idVer.warnings) ? idVer.warnings : [],
    raw: body,
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
// Mengembalikan { status, fullName, nik, placeOfBirth, dateOfBirth, sex, address, warnings }.
export async function scanKtp(file, { signal } = {}) {
  const form = new FormData()
  form.append('front_image', file)
  form.append('vendor_data', `register-${Date.now()}`)
  form.append('consent', 'true')

  const res = await fetch(DIDIT_PROXY, {
    method: 'POST',
    body: form,
    signal,
  })

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

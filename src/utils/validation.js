// Utilitas validasi input

export const DIVISION_OPTIONS = [
  'Business Development',
  'Finance & Accounting',
  'Produksi Prasasti',
  'Produksi Mutiari Garden',
  'HR & IT',
]

export function validateDivision(division) {
  if (!division) return { isValid: false, error: 'Divisi wajib dipilih.' }
  if (!DIVISION_OPTIONS.includes(division)) {
    return { isValid: false, error: 'Pilihan divisi tidak valid.' }
  }
  return { isValid: true }
}

export function validateKtp(ktp) {
  if (!ktp) return { isValid: false, error: 'Nomor KTP wajib diisi.' }
  if (!/^\d+$/.test(ktp)) return { isValid: false, error: 'Nomor KTP hanya boleh angka.' }
  if (ktp.length !== 16) return { isValid: false, error: 'Nomor KTP harus 16 digit.' }
  return { isValid: true }
}

export function validateUsername(username) {
  if (!username) return { isValid: false, error: 'Username wajib diisi.' }
  if (username.length < 3) return { isValid: false, error: 'Username minimal 3 karakter.' }
  if (username.length > 32) return { isValid: false, error: 'Username maksimal 32 karakter.' }
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return { isValid: false, error: 'Username hanya boleh huruf, angka, titik, dan underscore.' }
  }
  return { isValid: true }
}

export function validateFullName(name) {
  if (!name) return { isValid: false, error: 'Nama lengkap wajib diisi.' }
  if (name.trim().length < 3) return { isValid: false, error: 'Nama lengkap minimal 3 karakter.' }
  if (name.trim().length > 100) return { isValid: false, error: 'Nama lengkap maksimal 100 karakter.' }
  return { isValid: true }
}

export function validateBirthPlace(place) {
  const v = String(place || '').trim()
  if (!v) return { isValid: false, error: 'Tempat lahir wajib diisi.' }
  if (v.length < 2) return { isValid: false, error: 'Tempat lahir minimal 2 karakter.' }
  if (v.length > 60) return { isValid: false, error: 'Tempat lahir maksimal 60 karakter.' }
  return { isValid: true }
}

export function validateBirthDate(date) {
  if (!date) return { isValid: false, error: 'Tanggal lahir wajib diisi.' }
  // input type=date → "YYYY-MM-DD"
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return { isValid: false, error: 'Format tanggal lahir tidak valid.' }
  const [, y, mo, d] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return { isValid: false, error: 'Tanggal lahir tidak valid.' }
  }
  const now = new Date()
  if (dt > now) return { isValid: false, error: 'Tanggal lahir tidak boleh di masa depan.' }
  const ageYears = (now - dt) / (365.25 * 24 * 60 * 60 * 1000)
  if (ageYears < 17) return { isValid: false, error: 'Usia minimal 17 tahun.' }
  if (ageYears > 100) return { isValid: false, error: 'Tanggal lahir tidak realistis.' }
  return { isValid: true }
}

export function validateSex(sex) {
  if (!sex) return { isValid: false, error: 'Jenis kelamin wajib dipilih.' }
  if (!['M', 'F'].includes(sex)) return { isValid: false, error: 'Jenis kelamin tidak valid.' }
  return { isValid: true }
}

export function validateAddress(address) {
  const v = String(address || '').trim()
  if (!v) return { isValid: false, error: 'Alamat wajib diisi.' }
  if (v.length < 10) return { isValid: false, error: 'Alamat minimal 10 karakter.' }
  if (v.length > 250) return { isValid: false, error: 'Alamat maksimal 250 karakter.' }
  return { isValid: true }
}

// Validasi nomor HP Indonesia — opsional, tapi jika diisi:
//   - Harus berisi angka saja
//   - Harus dimulai dari "08"
//   - Maksimal 13 digit
export function validatePhone(phone) {
  const v = String(phone || '').trim()
  if (!v) return { isValid: true } // field opsional
  if (!/^\d+$/.test(v)) return { isValid: false, error: 'Nomor HP hanya boleh berisi angka.' }
  if (!v.startsWith('08')) return { isValid: false, error: 'Nomor HP harus dimulai dari "08".' }
  if (v.length > 13) return { isValid: false, error: 'Nomor HP maksimal 13 angka.' }
  return { isValid: true }
}

// Validasi email pribadi — opsional, tapi jika diisi harus format email valid.
export function validatePersonalEmail(email) {
  const v = String(email || '').trim()
  if (!v) return { isValid: true } // field opsional
  if (v.length > 120) return { isValid: false, error: 'Email maksimal 120 karakter.' }
  // Regex sederhana: ada @ dan ada . setelah @
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return { isValid: false, error: 'Format email tidak valid.' }
  }
  return { isValid: true }
}

// Validasi nama kontak darurat — opsional, minimal 2 karakter jika diisi.
export function validateEmergencyContactName(name) {
  const v = String(name || '').trim()
  if (!v) return { isValid: true } // field opsional
  if (v.length < 2) return { isValid: false, error: 'Nama kontak darurat minimal 2 karakter.' }
  if (v.length > 60) return { isValid: false, error: 'Nama kontak darurat maksimal 60 karakter.' }
  return { isValid: true }
}

// Gabung tempat + tanggal lahir jadi TTL string (untuk ditampilan saja).
export function formatTtl(place, date) {
  const p = String(place || '').trim()
  const d = String(date || '').trim()
  if (!p && !d) return ''
  if (!d) return p
  // Format tanggal jadi "DD MMM YYYY" (Indonesia) untuk ringkasan.
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return `${p}, ${d}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const [, y, mo, dd] = m
  return `${p}, ${dd} ${months[Number(mo) - 1]} ${y}`
}

// Format tanggal lahir ISO (YYYY-MM-DD) → "DD MMM YYYY" (Indonesia).
// Return string kosong bila input kosong/tidak valid.
export function formatTgl(date) {
  const d = String(date || '').trim()
  if (!d) return ''
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return d
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const [, y, mo, dd] = m
  return `${Number(dd)} ${months[Number(mo) - 1]} ${y}`
}

export function validatePassword(password) {
  const errors = []
  if (!password) errors.push('Password wajib diisi.')
  else {
    if (password.length < 8) errors.push('Minimal 8 karakter.')
    if (!/[A-Z]/.test(password)) errors.push('Minimal 1 huruf besar.')
    if (!/[a-z]/.test(password)) errors.push('Minimal 1 huruf kecil.')
    if (!/[0-9]/.test(password)) errors.push('Minimal 1 angka.')
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Minimal 1 karakter spesial.')
  }
  const passed = !password ? 0 : [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  return {
    isStrong: errors.length === 0 && Boolean(password),
    errors,
    score: passed,
    maxScore: 5,
  }
}

export function maskKtp(ktp) {
  if (!ktp || ktp.length < 6) return ktp || ''
  const visible = 4
  const masked = '*'.repeat(Math.max(0, ktp.length - visible * 2))
  return `${ktp.slice(0, visible)}${masked}${ktp.slice(-visible)}`
}

// Utilitas untuk logika periode tutup buku (tanggal 25) dan buka buku (tanggal 26).

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

const WEEKDAY_NAMES = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
]

export function dateToKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Periode tutup buku tgl 25, buka buku tgl 26.
 * Jika tanggal hari ini >= 26, periode aktif adalah bulan depan.
 * Jika tanggal hari ini <= 25, periode aktif adalah bulan ini.
 */
export function getCurrentPeriod(today = new Date()) {
  const day = today.getDate()
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  let periodMonth = month
  let periodYear = year
  if (day >= 26) {
    periodMonth += 1
    if (periodMonth > 12) {
      periodMonth = 1
      periodYear += 1
    }
  }
  return { month: periodMonth, year: periodYear }
}

/**
 * Mengembalikan rentang tanggal untuk sebuah periode.
 * Periode N (bulan M, tahun Y) berjalan dari tgl 26 bulan sebelumnya
 * sampai tgl 25 bulan M.
 */
export function getPeriodRange(periodMonth, periodYear) {
  // periodMonth: 1-12 (dari getCurrentPeriod) atau 0-11 (legacy). Normalisasi ke 1-12.
  let pm = periodMonth
  // jika 0-11 dan kemungkinan 0,Mapping: 0->Jan, 11->Dec, tapi kalau dipanggil dengan 8 (Aug) bisa ambigu antara 0-index Aug (7) vs 1-index Aug (8)
  // Kita deteksi: jika pm === 0, itu Jan 0-index -> perlakukan sebagai Jan
  // Jika pm >=1 && pm <=12, perlakukan sebagai 1-12
  if (pm >= 1 && pm <= 12) {
    const end = new Date(periodYear, pm - 1, 25, 23, 59, 59, 999)
    let sIdx = pm - 2 // 0-index bulan start (prev month)
    let sYear = periodYear
    if (sIdx < 0) { sIdx = 11; sYear -= 1 }
    const start = new Date(sYear, sIdx, 26)
    return { start, end }
  }
  // fallback 0-11 legacy
  const startMonth = pm === 0 ? 11 : pm - 1
  const startYear = pm === 0 ? periodYear - 1 : periodYear
  const start = new Date(startYear, startMonth, 26)
  const end = new Date(periodYear, pm, 25, 23, 59, 59, 999)
  return { start, end }
}

export function getPeriodStatus(periodMonth, periodYear, today = new Date()) {
  const current = getCurrentPeriod(today)
  if (current.month === periodMonth && current.year === periodYear) return 'aktif'
  const { end } = getPeriodRange(periodMonth, periodYear)
  if (today.getTime() > end.getTime()) return 'selesai'
  return 'akan-datang'
}

export function formatPeriodLabel(month, year) {
  // month bisa 1-12 atau 0-11, normalisasi ke 0-11
  const idx = month >= 1 && month <= 12 ? month - 1 : month
  return `${MONTH_NAMES[idx]} ${year}`
}

export function formatPeriodRange(periodMonth, periodYear) {
  const { start, end } = getPeriodRange(periodMonth, periodYear)
  const startMonth = start.getMonth()
  const endMonth = end.getMonth()
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  if (startYear === endYear) {
    return `${start.getDate()} ${SHORT_MONTH_NAMES[startMonth]} – ${end.getDate()} ${SHORT_MONTH_NAMES[endMonth]} ${endYear}`
  }
  return `${start.getDate()} ${SHORT_MONTH_NAMES[startMonth]} ${startYear} – ${end.getDate()} ${SHORT_MONTH_NAMES[endMonth]} ${endYear}`
}

export function enumeratePeriodDays(periodMonth, periodYear) {
  const { start, end } = getPeriodRange(periodMonth, periodYear)
  const days = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function formatDayLabel(date) {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export function formatShortDay(date) {
  return `${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

// ---------- Kalender murni (1 – akhir bulan) ----------
// Dipakai setelah instruksi "abaikan buka/tutup buku, patokannya per bulan".

export function getCalendarMonthRange(month, year) {
  const lastDay = new Date(year, month, 0).getDate()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month - 1, lastDay, 23, 59, 59, 999)
  return { start, end }
}

export function enumerateCalendarMonthDays(month, year) {
  const { start, end } = getCalendarMonthRange(month, year)
  const days = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function formatCalendarMonthRange(month, year) {
  const { start, end } = getCalendarMonthRange(month, year)
  return `1 – ${end.getDate()} ${SHORT_MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`
}

export function getCurrentCalendarMonth(today = new Date()) {
  return { month: today.getMonth() + 1, year: today.getFullYear() }
}

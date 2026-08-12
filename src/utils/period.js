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
  const month = today.getMonth()
  const year = today.getFullYear()
  let periodMonth, periodYear
  if (day >= 26) {
    periodMonth = month + 1
    periodYear = year
    if (periodMonth > 11) {
      periodMonth = 0
      periodYear += 1
    }
  } else {
    periodMonth = month
    periodYear = year
  }
  return { month: periodMonth, year: periodYear }
}

/**
 * Mengembalikan rentang tanggal untuk sebuah periode.
 * Periode N (bulan M, tahun Y) berjalan dari tgl 26 bulan sebelumnya
 * sampai tgl 25 bulan M.
 */
export function getPeriodRange(periodMonth, periodYear) {
  const startMonth = periodMonth === 0 ? 11 : periodMonth - 1
  const startYear = periodMonth === 0 ? periodYear - 1 : periodYear
  const start = new Date(startYear, startMonth, 26)
  const end = new Date(periodYear, periodMonth, 25, 23, 59, 59, 999)
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
  return `${MONTH_NAMES[month]} ${year}`
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

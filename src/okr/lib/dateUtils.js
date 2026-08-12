const HARI_INDONESIA = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
]

const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export const WIB_TIMEZONE = 'Asia/Jakarta'

function getWibParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '0'
  const year = parseInt(get('year'), 10)
  const month = parseInt(get('month'), 10)
  const day = parseInt(get('day'), 10)
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0
  const minute = parseInt(get('minute'), 10)
  const second = parseInt(get('second'), 10)
  const weekdayShort = get('weekday')
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekday = weekdayMap[weekdayShort] ?? 0
  return { year, month, day, hour, minute, second, weekday }
}

export function getTodayDateString() {
  const p = getWibParts()
  const m = String(p.month).padStart(2, '0')
  const d = String(p.day).padStart(2, '0')
  return `${p.year}-${m}-${d}`
}

export function getWibDateStringFor(date) {
  const p = getWibParts(date)
  const m = String(p.month).padStart(2, '0')
  const d = String(p.day).padStart(2, '0')
  return `${p.year}-${m}-${d}`
}

export function formatDateIndonesian(date) {
  const p = getWibParts(date)
  return `${HARI_INDONESIA[p.weekday]}, ${p.day} ${
    BULAN_INDONESIA[p.month - 1]
  } ${p.year}`
}

export function formatDateStringIndonesian(yyyyMmDd) {
  const [yStr, mStr, dStr] = yyyyMmDd.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)
  const dt = new Date(Date.UTC(year, month - 1, day))
  const weekday = dt.getUTCDay()
  return `${HARI_INDONESIA[weekday]}, ${day} ${
    BULAN_INDONESIA[month - 1]
  } ${year}`
}

export function formatTimeWib(isoTimestamp) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: WIB_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return fmt.format(new Date(isoTimestamp))
  } catch {
    return ''
  }
}

export function getStorageKey(username, date) {
  return `dit_inputs_${username}_${date}`
}

export function msUntilNextWibMidnight(now = new Date()) {
  const p = getWibParts(now)
  const elapsedSec = p.hour * 3600 + p.minute * 60 + p.second
  const totalSecPerDay = 86400
  const remainingSec = totalSecPerDay - elapsedSec
  return remainingSec * 1000
}

export function getWibHour(date = new Date()) {
  return getWibParts(date).hour
}

export function getTimeBasedGreeting(date = new Date()) {
  const hour = getWibHour(date)
  if (hour >= 5 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function getWibWeekday(yyyyMmDd) {
  const [yStr, mStr, dStr] = yyyyMmDd.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCDay()
}

export function isWeekend(yyyyMmDd) {
  const w = getWibWeekday(yyyyMmDd)
  return w === 0 || w === 6
}

export function addDays(yyyyMmDd, n) {
  const [yStr, mStr, dStr] = yyyyMmDd.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)
  const dt = new Date(Date.UTC(year, month - 1, day))
  dt.setUTCDate(dt.getUTCDate() + n)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getMondayOfWeek(yyyyMmDd) {
  const w = getWibWeekday(yyyyMmDd)
  const back = w === 0 ? 6 : w - 1
  return addDays(yyyyMmDd, -back)
}

export function getDateRange(from, to) {
  if (to.localeCompare(from) < 0) return []
  const out = []
  let cur = from
  for (let i = 0; i < 400; i++) {
    out.push(cur)
    if (cur === to) break
    cur = addDays(cur, 1)
  }
  return out
}

export function getWeekDates(yyyyMmDd, today) {
  const monday = getMondayOfWeek(yyyyMmDd)
  const sunday = addDays(monday, 6)
  const end = sunday.localeCompare(today) > 0 ? today : sunday
  return getDateRange(monday, end)
}

export function getMonthDates(yyyyMmDd, today) {
  const [yStr, mStr] = yyyyMmDd.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const first = `${yStr}-${mStr}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`
  const end = last.localeCompare(today) > 0 ? today : last
  return getDateRange(first, end)
}

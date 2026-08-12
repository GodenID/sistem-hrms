// Indonesian National Holidays (Libur Nasional) for 2026-2027.
// NOTE: Dates are based on the SKB 3 Menteri calendar and Islamic calendar
// approximations. Tanggal pasti Idul Fitri / Idul Adha / Tahun Baru Islam
// biasanya dikonfirmasi ulang oleh pemerintah 1-2 bulan sebelumnya dan
// bisa bergeser ±1 hari. Treat sebagai referensi, bukan acuan final.
//
// Format: { date: 'YYYY-MM-DD', name: string, category: string }
// Categories: 'masehi' | 'islam' | 'budha' | 'hindu' | ' Kristen' | 'nasional'
export const INDONESIAN_HOLIDAYS = [
  // ===== 2026 =====
  { date: '2026-01-01', name: 'Tahun Baru Masehi 2026', category: 'masehi' },
  { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW', category: 'islam' },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577', category: 'budha' },
  { date: '2026-03-19', name: 'Hari Suci Nyepi', category: 'hindu' },
  { date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 H', category: 'islam' },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H', category: 'islam' },
  { date: '2026-04-03', name: 'Wafat Isa Almasih', category: 'kristen' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional', category: 'nasional' },
  { date: '2026-05-14', name: 'Kenaikan Isa Almasih', category: 'kristen' },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H', category: 'islam' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', category: 'nasional' },
  { date: '2026-06-16', name: 'Tahun Baru Islam 1448 H', category: 'islam' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI ke-81', category: 'nasional' },
  { date: '2026-09-25', name: 'Maulid Nabi Muhammad SAW', category: 'islam' },
  { date: '2026-09-26', name: 'Maulid Nabi Muhammad SAW', category: 'islam' },
  { date: '2026-12-25', name: 'Hari Raya Natal', category: 'kristen' },

  // ===== 2027 =====
  { date: '2027-01-01', name: 'Tahun Baru Masehi 2027', category: 'masehi' },
  { date: '2027-01-05', name: 'Isra Mikraj Nabi Muhammad SAW', category: 'islam' },
  { date: '2027-02-06', name: 'Tahun Baru Imlek 2578', category: 'budha' },
  { date: '2027-03-08', name: 'Hari Suci Nyepi', category: 'hindu' },
  { date: '2027-03-09', name: 'Hari Raya Idul Fitri 1448 H', category: 'islam' },
  { date: '2027-03-10', name: 'Hari Raya Idul Fitri 1448 H', category: 'islam' },
  { date: '2027-03-26', name: 'Wafat Isa Almasih', category: 'kristen' },
  { date: '2027-05-01', name: 'Hari Buruh Internasional', category: 'nasional' },
  { date: '2027-05-06', name: 'Kenaikan Isa Almasih', category: 'kristen' },
  { date: '2027-05-16', name: 'Hari Raya Idul Adha 1448 H', category: 'islam' },
  { date: '2027-06-01', name: 'Hari Lahir Pancasila', category: 'nasional' },
  { date: '2027-06-06', name: 'Tahun Baru Islam 1449 H', category: 'islam' },
  { date: '2027-08-17', name: 'Hari Kemerdekaan RI ke-82', category: 'nasional' },
  { date: '2027-09-14', name: 'Maulid Nabi Muhammad SAW', category: 'islam' },
  { date: '2027-09-15', name: 'Maulid Nabi Muhammad SAW', category: 'islam' },
  { date: '2027-12-25', name: 'Hari Raya Natal', category: 'kristen' },
]

const HOLIDAY_MAP = new Map(INDONESIAN_HOLIDAYS.map((h) => [h.date, h]))

export function getHoliday(dateStr) {
  if (!dateStr) return null
  return HOLIDAY_MAP.get(dateStr) || null
}

export function isHoliday(dateStr) {
  return HOLIDAY_MAP.has(dateStr)
}

export function getHolidaysInRange(startDate, endDate) {
  return INDONESIAN_HOLIDAYS
    .filter((h) => h.date >= startDate && h.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getUpcomingHolidays(count = 3) {
  const today = new Date().toISOString().slice(0, 10)
  return INDONESIAN_HOLIDAYS
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count)
}

export function formatHolidayDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export const HOLIDAY_CATEGORY_LABEL = {
  masehi: 'Masehi',
  islam: 'Islam',
  budha: 'Buddha',
  hindu: 'Hindu',
  kristen: 'Kristen',
  nasional: 'Nasional',
}

export const HOLIDAY_CATEGORY_COLOR = {
  masehi: 'border-sky-200 bg-sky-50 text-sky-700',
  islam: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  budha: 'border-rose-200 bg-rose-50 text-rose-700',
  hindu: 'border-orange-200 bg-orange-50 text-orange-700',
  kristen: 'border-violet-200 bg-violet-50 text-violet-700',
  nasional: 'border-red-200 bg-red-50 text-red-700',
}

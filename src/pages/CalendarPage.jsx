import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEvents } from '../context/EventsContext'
import { useHolidays } from '../context/HolidaysContext'
import Modal from '../components/Modal'

// ============================================================
// Konstanta & helpers
// ============================================================

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

// Palet untuk jenis item kalender + warna weekend.
// Prioritas warna cell: holiday > event > weekend > default.
const COLOR = {
  event: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  holiday: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', dot: 'bg-rose-500' },
  weekend: { bg: 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-100', dot: 'bg-rose-300' },
}

// Format tanggal konsisten 'YYYY-MM-DD' (string) untuk dipakai sebagai key map.
function toIsoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Expand rentang tanggal [start, end] inklusif → array of 'YYYY-MM-DD'.
function expandDateRange(startIso, endIso) {
  if (!startIso || !endIso) return []
  const out = []
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(toIsoDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function formatLongDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-5 flex items-center gap-3 animate-fade-in">
      <Link
        to="/"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
        aria-label="Kembali"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ============================================================
// Halaman utama
// ============================================================

export default function CalendarPage() {
  const { events } = useEvents()
  const { allHolidays, formatHolidayDate, categoryLabel, categoryColor } = useHolidays()

  // Navigasi bulan — default bulan ini
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Filter jenis item yang ditampilkan (calendar menu utama: hanya event & libur)
  const [filters, setFilters] = useState({ event: true, holiday: true })

  // Detail modal
  const [selectedDate, setSelectedDate] = useState(null)

  // ============================================================
  // Bangun map date → items untuk bulan yang sedang dilihat
  // ============================================================
  const itemsByDate = useMemo(() => {
    const map = new Map()

    const addItem = (date, type, payload) => {
      if (!date) return
      const list = map.get(date) || []
      list.push({ type, ...payload })
      map.set(date, list)
    }

    // Events: date tunggal atau range
    if (filters.event) {
      for (const e of events || []) {
        if (e.status !== 'approved') continue
        const start = e.startDate || e.date
        if (!start) continue
        const end = e.endDate || start
        const monthPad = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
        if (!start.startsWith(monthPad) && !end.startsWith(monthPad)) {
          const startAfterMonth = start > `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-31`
          const endBeforeMonth = end < `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
          if (startAfterMonth || endBeforeMonth) continue
        }
        const startD = new Date(start + 'T00:00:00')
        const endD = new Date(end + 'T00:00:00')
        const cur = new Date(startD)
        while (cur <= endD) {
          const key = cur.toISOString().slice(0, 10)
          if (key.startsWith(monthPad)) {
            addItem(key, 'event', { id: e.id, title: e.name, location: e.location, createdBy: e.createdBy })
          }
          cur.setDate(cur.getDate() + 1)
        }
      }
    }

    // Holidays: date tunggal
    if (filters.holiday) {
      for (const h of allHolidays || []) {
        if (!h.date) continue
        if (!h.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`)) continue
        addItem(h.date, 'holiday', { id: h.id || h.date, title: h.name, category: h.category })
      }
    }

    return map
  }, [events, allHolidays, viewYear, viewMonth, filters])

  // ============================================================
  // Grid bulan: 6 baris × 7 kolom. Beberapa bulan butuh 6 minggu.
  // ============================================================
  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay() // 0 = Minggu
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const cells = []
    // Cells kosong sebelum hari pertama
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ key: `empty-pre-${i}`, empty: true })
    }
    // Cells hari dalam bulan
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d)
      const iso = toIsoDate(dateObj)
      const isToday = iso === toIsoDate(today)
      const weekday = dateObj.getDay() // 0 = Minggu, 6 = Sabtu
      cells.push({
        key: iso,
        iso,
        day: d,
        weekday,
        isToday,
        items: itemsByDate.get(iso) || [],
      })
    }
    // Pad sampai kelipatan 7
    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-post-${cells.length}`, empty: true })
    }
    return cells
  }, [viewYear, viewMonth, itemsByDate, today])

  // ============================================================
  // Navigasi bulan
  // ============================================================
  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  const toggleFilter = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }))

  // Items untuk modal detail
  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) || [] : []

  // Statistik bulan ini (untuk header filter chips)
  const monthStats = useMemo(() => {
    let event = 0, holiday = 0
    for (const items of itemsByDate.values()) {
      for (const it of items) {
        if (it.type === 'event') event++
        else if (it.type === 'holiday') holiday++
      }
    }
    return { event, holiday }
  }, [itemsByDate])

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader title="Kalender" subtitle="Event, hari libur, & cuti dalam satu tampilan" />

      {/* Navigasi bulan */}
      <div className="card mb-4 flex items-center justify-between p-3 animate-slide-up">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
          aria-label="Bulan sebelumnya"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-slate-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <button
            type="button"
            onClick={goToday}
            className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700"
          >
            Hari ini
          </button>
        </div>
        <button
          type="button"
          onClick={goNext}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
          aria-label="Bulan berikutnya"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <FilterChip
          active={filters.event}
          color={COLOR.event}
          label="Event"
          count={monthStats.event}
          onClick={() => toggleFilter('event')}
        />
        <FilterChip
          active={filters.holiday}
          color={COLOR.holiday}
          label="Libur"
          count={monthStats.holiday}
          onClick={() => toggleFilter('holiday')}
        />
      </div>

      {/* Grid kalender */}
      <div className="card overflow-hidden p-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {/* Header hari */}
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </div>
          ))}
        </div>

        {/* Cells tanggal */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell) => {
            if (cell.empty) {
              return <div key={cell.key} className="aspect-square" />
            }
            const hasItems = cell.items.length > 0
            const hasEvent = cell.items.some((i) => i.type === 'event')
            const hasHoliday = cell.items.some((i) => i.type === 'holiday')
            const isWeekend = cell.weekday === 0 || cell.weekday === 6

            // Prioritas warna cell: holiday > event > weekend > default.
            // Hari ini selalu ditandai dengan border tebal indigo (override).
            let palette = { bg: 'bg-white', text: 'text-slate-700', border: 'border-slate-100' }
            if (hasHoliday) palette = COLOR.holiday
            else if (hasEvent) palette = COLOR.event
            else if (isWeekend) palette = COLOR.weekend

            const todayBorder = cell.isToday ? 'border-2 border-indigo-600' : palette.border

            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => hasItems && setSelectedDate(cell.iso)}
                disabled={!hasItems}
                className={[
                  'relative flex aspect-square flex-col items-center justify-center rounded-lg border transition',
                  todayBorder,
                  palette.bg,
                  palette.text,
                  cell.isToday && 'font-extrabold',
                  hasItems ? 'hover:shadow-md active:scale-95' : 'cursor-default',
                ].join(' ')}
              >
                <span className="text-[11px] font-bold leading-none">{cell.day}</span>
                {hasItems && (
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider opacity-80">
                    {hasHoliday && hasEvent ? 'E+L' : hasHoliday ? 'L' : 'E'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 animate-fade-in">
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${COLOR.event.bg} ${COLOR.event.border}`} /> Event
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${COLOR.holiday.bg} ${COLOR.holiday.border}`} /> Hari Libur
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${COLOR.weekend.bg} ${COLOR.weekend.border}`} /> Weekend (Sabtu/Minggu)
        </span>
      </div>

      {/* Modal detail tanggal */}
      <Modal
        open={Boolean(selectedDate)}
        title={selectedDate ? formatLongDate(selectedDate) : ''}
        onClose={() => setSelectedDate(null)}
      >
        {selectedItems.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada item pada tanggal ini.</p>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((item, idx) => (
              <ItemRow key={`${item.type}-${item.id}-${idx}`} item={item} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ============================================================
// Sub-komponen
// ============================================================

function FilterChip({ active, color, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-95',
        active
          ? `${color.bg} ${color.text} border-transparent`
          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300',
      ].join(' ')}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? color.dot : 'bg-slate-300'}`} />
      {label}
      <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  )
}

function ItemRow({ item }) {
  const c = COLOR[item.type] || COLOR.event
  const badge = item.type === 'holiday' ? 'Hari Libur' : 'Event'

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${c.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
        </div>
        {item.location && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">📍 {item.location}</p>
        )}
        {item.createdBy && item.type === 'event' && (
          <p className="mt-0.5 text-[10px] text-slate-400">oleh {item.createdBy}</p>
        )}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
        {badge}
      </span>
    </div>
  )
}

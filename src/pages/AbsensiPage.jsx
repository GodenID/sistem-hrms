import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClock } from '../context/ClockContext'
import { usePengajuan } from '../context/PengajuanContext'
import { useHolidays } from '../context/HolidaysContext'
import Modal from '../components/Modal'
import { STATUS } from '../utils/status'
import {
  dateToKey,
  enumerateCalendarMonthDays,
  formatCalendarMonthRange,
  getCalendarMonthRange,
  getCurrentCalendarMonth,
} from '../utils/period'

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

function stripWib(value) {
  if (!value) return '--:--:--'
  return value.replace(' WIB', '')
}

export default function AbsensiPage() {
  const { currentUser } = useAuth()
  const clockContext = useClock()
  const { pengajuan } = usePengajuan()
  const { getHoliday, getHolidaysForMonth } = useHolidays()
  const [selected, setSelected] = useState(() => getCurrentCalendarMonth())

  const getHistory = clockContext.getHistoryByDateRange

  const periodDetail = useMemo(() => {
    const days = enumerateCalendarMonthDays(selected.month, selected.year)
    const { start, end } = getCalendarMonthRange(selected.month, selected.year)
    const history = getHistory(dateToKey(start), dateToKey(end)).filter(
      (h) => h.userId === currentUser?.id
    )
    const map = new Map(history.map((h) => [h.date, h]))
    const todayKey = dateToKey(new Date())
    const now = new Date()
    const rows = days.map((d) => {
      const key = dateToKey(d)
      const rec = map.get(key)
      return {
        key,
        date: d,
        clockIn: rec?.clockIn || null,
        clockOut: rec?.clockOut || null,
        isToday: key === todayKey,
        isFuture: d.getTime() > now.getTime(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      }
    })
    const presentDays = rows.filter((r) => r.clockIn || r.clockOut).length
    return { rows, presentDays, totalDays: rows.length }
  }, [selected, getHistory, currentUser])

  const goPrev = () => {
    let newMonth = selected.month - 1
    let newYear = selected.year
    if (newMonth < 1) { newMonth = 12; newYear -= 1 }
    setSelected({ month: newMonth, year: newYear })
  }

  const goNext = () => {
    let newMonth = selected.month + 1
    let newYear = selected.year
    if (newMonth > 12) { newMonth = 1; newYear += 1 }
    setSelected({ month: newMonth, year: newYear })
  }

  const goToday = () => setSelected(getCurrentCalendarMonth())

  const monthLabel = new Date(selected.year, selected.month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const touchStart = React.useRef(null)
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStart.current == null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext()
      else goPrev()
    }
    touchStart.current = null
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <PageHeader title="Riwayat Absensi" subtitle="Geser kiri/kanan untuk ganti bulan" />

      {/* Bulan navigasi */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2">
        <button
          onClick={goPrev}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 active:scale-95"
          aria-label="Bulan sebelumnya"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-base font-bold text-slate-900">{monthLabel}</h3>
        <button
          onClick={goNext}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 active:scale-95"
          aria-label="Bulan berikutnya"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Ringkasan ringkas */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hari Hadir</p>
          <p className="text-xl font-extrabold text-slate-900">
            {periodDetail?.presentDays ?? 0}
            <span className="ml-1 text-xs font-semibold text-slate-400">/ {periodDetail?.totalDays ?? 0} hari</span>
          </p>
        </div>
        <p className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {formatCalendarMonthRange(selected.month, selected.year)}
        </p>
      </div>

      <AbsensiCalendarView
          currentUser={currentUser}
          pengajuan={pengajuan}
          selected={selected}
          getHistory={getHistory}
          getHoliday={getHoliday}
          getHolidaysForMonth={getHolidaysForMonth}
        />
    </div>
  )
}

const DAY_NAMES_MINI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function formatDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const toSec = (t) => {
    const m = String(t).match(/(\d{2}):(\d{2}):(\d{2})/)
    if (!m) return null
    return +m[1] * 3600 + +m[2] * 60 + +m[3]
  }
  const a = toSec(clockIn)
  const b = toSec(clockOut)
  if (a == null || b == null) return null
  let diff = b - a
  if (diff < 0) diff += 24 * 3600
  const h = Math.floor(diff / 3600)
  const min = Math.round((diff % 3600) / 60)
  return `${h}j ${min}m`
}

function AbsensiCalendarView({ currentUser, pengajuan, selected, getHistory, getHoliday, getHolidaysForMonth }) {
  const month = selected.month
  const year = selected.year
  const [detailDate, setDetailDate] = useState(null)

  // Build history map (clock records) for this calendar month
  const historyByDate = useMemo(() => {
    if (!currentUser) return new Map()
    const lastDay = new Date(year, month, 0).getDate()
    const startKey = dateToKey(new Date(year, month - 1, 1))
    const endKey = dateToKey(new Date(year, month - 1, lastDay))
    const list = getHistory(startKey, endKey).filter((h) => h.userId === currentUser.id)
    return new Map(list.map((h) => [h.date, h]))
  }, [currentUser, getHistory, year, month])

  // Build pengajuan map for this month
  const pengajuanByDate = useMemo(() => {
    if (!currentUser) return new Map()
    const lastDay = new Date(year, month, 0).getDate()
    const startKey = dateToKey(new Date(year, month - 1, 1))
    const endKey = dateToKey(new Date(year, month - 1, lastDay))
    const map = new Map()
    pengajuan
      .filter(
        (p) =>
          p.userId === currentUser.id &&
          (p.type === 'cuti' || p.type === 'sakit') &&
          p.startDate <= endKey &&
          p.endDate >= startKey,
      )
      .sort((a, b) => {
        // approved dulu biar prioritas di kalender
        if (a.status === 'approved' && b.status !== 'approved') return -1
        if (a.status !== 'approved' && b.status === 'approved') return 1
        return 0
      })
      .forEach((p) => {
        const startD = new Date(p.startDate + 'T00:00:00')
        const endD = new Date(p.endDate + 'T00:00:00')
        const cur = new Date(startD)
        while (cur <= endD) {
          const key = dateToKey(cur)
          const existing = map.get(key)
          if (!existing) map.set(key, p)
          else if (existing.status !== 'approved' && p.status === 'approved') map.set(key, p)
          cur.setDate(cur.getDate() + 1)
        }
      })
    return map
  }, [currentUser, pengajuan, month, year])

  // Build grid: 42 cells (6 rows × 7 cols), with null for empty leading/trailing cells
  const grid = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate()
    const firstDay = new Date(year, month - 1, 1)
    // Indonesian: Mon=0, Tue=1, ..., Sun=6
    const firstDayIdx = (firstDay.getDay() + 6) % 7
    const cells = []
    for (let i = 0; i < firstDayIdx; i += 1) cells.push(null)
    for (let d = 1; d <= lastDay; d += 1) cells.push(d)
    while (cells.length < 42) cells.push(null)
    return cells
  }, [month, year])

  const todayKey = dateToKey(new Date())

  return (
    <div className="animate-fade-in">
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_NAMES_MINI.map((d) => (
          <div key={d} className="py-1 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="aspect-square" />

          const dateKey = dateToKey(new Date(year, month - 1, day))
          const isToday = dateKey === todayKey
          const dayOfWeek = new Date(year, month - 1, day).getDay()
          const leave = pengajuanByDate.get(dateKey)
          const holiday = getHoliday(dateKey)
          const rec = historyByDate.get(dateKey)
          const attended = !!(rec?.clockIn || rec?.clockOut)

          let bgClass = ''
          let textClass = 'text-slate-700'
          let label = null
          let titleText = null

          if (holiday) {
            bgClass = 'bg-red-100'
            textClass = 'text-red-700'
            label = '🇮🇩'
            titleText = holiday.name
          } else if (leave && (leave.type === 'cuti' || leave.type === 'sakit')) {
            if (leave.status === 'approved') {
              bgClass = 'bg-amber-100'
              textClass = 'text-amber-800'
              label = 'Cuti'
              titleText = 'Cuti tahunan disetujui'
            } else if (leave.status === 'pending') {
              bgClass = 'bg-violet-100'
              textClass = 'text-violet-700'
              label = 'Ajuan'
              titleText = 'Pengajuan cuti menunggu persetujuan'
            } else {
              bgClass = 'bg-slate-100'
              textClass = 'text-slate-500'
              label = 'Tolak'
              titleText = 'Pengajuan ditolak'
            }
          } else if (attended) {
            bgClass = 'bg-emerald-100'
            textClass = 'text-emerald-700'
            label = rec?.clockIn && !rec?.clockOut ? 'In' : '✓'
            titleText = 'Sudah absen — klik untuk detail'
          } else if (dayOfWeek === 0 || dayOfWeek === 6) {
            bgClass = 'bg-red-100'
            textClass = 'text-red-700'
            label = 'Libur'
            titleText = 'Akhir Pekan'
          } else {
            bgClass = 'bg-slate-50'
            textClass = 'text-slate-400'
            titleText = 'Belum absen'
          }

          return (
            <button
              key={`day-${day}`}
              type="button"
              onClick={() => setDetailDate(dateKey)}
              title={titleText || undefined}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition ${bgClass} ${isToday ? 'ring-2 ring-indigo-500 font-extrabold' : 'hover:ring-1 hover:ring-indigo-300 active:scale-95'}`}
            >
              <span className={`text-sm font-bold ${textClass}`}>{day}</span>
              {label && <span className={`font-mono text-[8px] font-bold leading-none ${textClass}`}>{label}</span>}
            </button>
          )
        })}
      </div>

      {/* Legend — token terpusat STATUS */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS.hadir.bg}`} /><span className="text-slate-700">{STATUS.hadir.label}</span></div>
          <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS.belum.bg} ${STATUS.belum.ring || ''}`} /><span className="text-slate-700">{STATUS.belum.label}</span></div>
          <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS.libur.bg}`} /><span className="text-slate-700">{STATUS.libur.label}</span></div>
          <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS.cuti.bg}`} /><span className="text-slate-700">{STATUS.cuti.label}</span></div>
          <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS.pengajuan.bg}`} /><span className="text-slate-700">{STATUS.pengajuan.label}</span></div>
        </div>
      </div>

      {/* Modal detail tanggal */}
      <Modal
        open={Boolean(detailDate)}
        title={detailDate
          ? new Date(detailDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : ''}
        onClose={() => setDetailDate(null)}
      >
        {(() => {
          if (!detailDate) return null
          const rec = historyByDate.get(detailDate)
          const leave = pengajuanByDate.get(detailDate)
          const holiday = getHoliday(detailDate)
          const detailDayOfWeek = new Date(detailDate + 'T00:00:00').getDay()
          const isWeekend = detailDayOfWeek === 0 || detailDayOfWeek === 6
          const duration = formatDuration(rec?.clockIn, rec?.clockOut)

          return (
            <div className="space-y-3">
              {holiday && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <span className="text-base">🇮🇩</span>
                  <div>
                    <p className="text-sm font-bold text-red-700">Hari Libur Nasional</p>
                    <p className="text-xs text-red-600/80">{holiday.name}</p>
                  </div>
                </div>
              )}

              {leave && (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${leave.type === 'cuti' ? 'border-sky-200 bg-sky-50' : 'border-rose-200 bg-rose-50'}`}>
                  <span className="text-base">{leave.type === 'cuti' ? '🏖' : '🤒'}</span>
                  <div>
                    <p className={`text-sm font-bold ${leave.type === 'cuti' ? 'text-sky-700' : 'text-rose-700'}`}>
                      {leave.type === 'cuti' ? 'Cuti Tahunan' : 'Izin Sakit'}
                    </p>
                    <p className={`text-xs ${leave.type === 'cuti' ? 'text-sky-600/80' : 'text-rose-600/80'}`}>
                      {leave.reason || 'Pengajuan disetujui'}
                    </p>
                  </div>
                </div>
              )}

              {rec?.clockIn || rec?.clockOut ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clock In</p>
                    <p className={`mt-1 font-mono text-lg font-extrabold ${rec?.clockIn ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {stripWib(rec?.clockIn)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clock Out</p>
                    <p className={`mt-1 font-mono text-lg font-extrabold ${rec?.clockOut ? 'text-orange-500' : 'text-slate-300'}`}>
                      {stripWib(rec?.clockOut)}
                    </p>
                  </div>
                </div>
              ) : null}

              {duration && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold text-slate-500">Durasi</p>
                  <p className="font-mono text-sm font-extrabold text-slate-900">{duration}</p>
                </div>
              )}

              {!rec?.clockIn && !rec?.clockOut && !holiday && !leave && (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  {isWeekend ? '🏖 Akhir pekan — tidak ada absensi.' : 'Belum ada absensi pada tanggal ini.'}
                </p>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Holidays in the displayed month */}
      {(() => {
        const monthHolidays = getHolidaysForMonth(year, month)
        if (monthHolidays.length === 0) return null
        return (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Hari Libur Bulan Ini</p>
            <div className="space-y-1.5">
              {monthHolidays.map((h) => {
                const d = new Date(h.date + 'T00:00:00')
                return (
                  <div key={h.date} className="flex items-center gap-2.5 text-[11px]">
                    <div className="flex h-8 w-8 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-red-50 leading-none text-red-700">
                      <span className="text-[9px] font-normal uppercase opacity-70">{d.toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-sm font-extrabold">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{h.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

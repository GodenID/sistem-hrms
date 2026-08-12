import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClock } from '../context/ClockContext'
import { usePengajuan } from '../context/PengajuanContext'
import { useHolidays } from '../context/HolidaysContext'
import {
  dateToKey,
  enumeratePeriodDays,
  formatPeriodLabel,
  formatPeriodRange,
  getPeriodRange,
  getPeriodStatus,
} from '../utils/period'

const STATUS_LABEL = {
  aktif: 'Aktif',
  selesai: 'Selesai',
  'akan-datang': 'Akan Datang',
}

const STATUS_STYLE = {
  aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  selesai: 'bg-slate-100 text-slate-600 border-slate-200',
  'akan-datang': 'bg-amber-50 text-amber-700 border-amber-200',
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

function stripWib(value) {
  if (!value) return '--:--:--'
  return value.replace(' WIB', '')
}

export default function AbsensiPage() {
  const { currentUser } = useAuth()
  const clockContext = useClock()
  const { pengajuan } = usePengajuan()
  const { getHoliday, getHolidaysForMonth } = useHolidays()
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('semua') // semua | hadir | belum | akan
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'

  // Use getters directly from hook context to avoid unused-warning confusion
  const getAvailablePeriods = clockContext.getAvailablePeriods
  const getHistory = clockContext.getHistoryByDateRange

  const periods = useMemo(() => getAvailablePeriods(), [getAvailablePeriods])

  const periodDetail = useMemo(() => {
    if (!selected) return null
    const days = enumeratePeriodDays(selected.month, selected.year)
    const { start, end } = getPeriodRange(selected.month, selected.year)
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
      }
    })
    const presentDays = rows.filter((r) => r.clockIn || r.clockOut).length
    return { rows, presentDays, totalDays: rows.length }
  }, [selected, getHistory, currentUser])

  const filteredRows = useMemo(() => {
    if (!periodDetail) return []
    if (statusFilter === 'semua') return periodDetail.rows
    if (statusFilter === 'hadir') return periodDetail.rows.filter((r) => r.clockIn || r.clockOut)
    if (statusFilter === 'belum') return periodDetail.rows.filter((r) => !r.clockIn && !r.clockOut && !r.isFuture)
    if (statusFilter === 'akan') return periodDetail.rows.filter((r) => r.isFuture)
    return periodDetail.rows
  }, [periodDetail, statusFilter])

  // Build a map: dateKey → approved cuti/sakit pengajuan for the current user in this period
  const pengajuanByDate = useMemo(() => {
    if (!currentUser || !selected) return new Map()
    const { start, end } = getPeriodRange(selected.month, selected.year)
    const startKey = dateToKey(start)
    const endKey = dateToKey(end)
    const map = new Map()
    pengajuan
      .filter((p) =>
        p.userId === currentUser.id &&
        p.status === 'approved' &&
        (p.type === 'cuti' || p.type === 'sakit') &&
        p.startDate <= endKey &&
        p.endDate >= startKey
      )
      .forEach((p) => {
        const startD = new Date(p.startDate + 'T00:00:00')
        const endD = new Date(p.endDate + 'T00:00:00')
        const cur = new Date(startD)
        while (cur <= endD) {
          const key = dateToKey(cur)
          if (!map.has(key)) map.set(key, p)
          cur.setDate(cur.getDate() + 1)
        }
      })
    return map
  }, [pengajuan, currentUser, selected])

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader title="Riwayat Absensi" />

      {!selected ? (
        <>
          <div className="card mb-4 flex items-start gap-3 p-4 animate-fade-in">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Periode Tutup Buku</p>
              <p className="text-xs text-slate-600">
                Tutup buku setiap tanggal <strong>25</strong>. Buka buku periode baru setiap tanggal <strong>26</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {periods.map((p) => {
              const status = getPeriodStatus(p.month, p.year)
              return (
                <button
                  key={`${p.year}-${p.month}`}
                  onClick={() => setSelected(p)}
                  className="card flex w-full items-center justify-between p-4 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div>
                    <p className="text-base font-bold text-slate-900">{formatPeriodLabel(p.month, p.year)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatPeriodRange(p.month, p.year)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`chip border ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="animate-fade-in">
          <div className="card mb-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Periode</p>
                <p className="text-lg font-bold text-slate-900">{formatPeriodLabel(selected.month, selected.year)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatPeriodRange(selected.month, selected.year)}</p>
              </div>
              <span className={`chip border ${STATUS_STYLE[getPeriodStatus(selected.month, selected.year)]}`}>
                {STATUS_LABEL[getPeriodStatus(selected.month, selected.year)]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-500">Hari Hadir</p>
                <p className="text-2xl font-extrabold text-slate-900">{periodDetail?.presentDays ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Hari</p>
                <p className="text-2xl font-extrabold text-slate-900">{periodDetail?.totalDays ?? 0}</p>
              </div>
            </div>
          </div>

          {/* View mode toggle: List | Kalender */}
          <div className="mb-3 flex rounded-2xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${viewMode === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              📅 Kalender
            </button>
          </div>

          {viewMode === 'list' && (
            <>
              {/* Status filter chips */}
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {[
                  { id: 'semua', label: 'Semua' },
                  { id: 'hadir', label: 'Hadir' },
                  { id: 'belum', label: 'Belum' },
                  { id: 'akan', label: 'Akan Datang' },
                ].map((f) => {
                  const active = statusFilter === f.id
                  const count = f.id === 'semua' ? periodDetail.rows.length
                    : f.id === 'hadir' ? periodDetail.rows.filter((r) => r.clockIn || r.clockOut).length
                    : f.id === 'belum' ? periodDetail.rows.filter((r) => !r.clockIn && !r.clockOut && !r.isFuture).length
                    : periodDetail.rows.filter((r) => r.isFuture).length
                  return (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {f.label} <span className={`ml-1 font-mono text-[10px] ${active ? 'opacity-90' : 'text-slate-400'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                {filteredRows.length === 0 && (
                  <div className="card flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in">
                    <p className="text-sm text-slate-500">Tidak ada hari dengan status ini.</p>
                  </div>
                )}
                {filteredRows.map((row) => {
                  const leave = pengajuanByDate.get(row.key)
                  const holiday = getHoliday(row.key)
                  if (leave) {
                    const LEAVE_STYLES = {
                      cuti: { card: 'border-sky-200 bg-sky-50/50', chip: 'border-sky-200 bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
                      sakit: { card: 'border-rose-200 bg-rose-50/50', chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
                    }
                    const ls = LEAVE_STYLES[leave.type] || LEAVE_STYLES.cuti
                    const leaveLabel = leave.type === 'cuti' ? 'Cuti Tahunan' : 'Izin Sakit'
                    return (
                      <div
                        key={row.key}
                        className={`card flex items-center justify-between p-3 ${ls.card}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-bold ${row.isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                              {row.date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <span className={`chip border ${ls.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${ls.dot}`} />
                              {leaveLabel}
                            </span>
                            {holiday && (
                              <span title={holiday.name} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-700">
                                🇮🇩 {holiday.name}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {row.isToday ? 'Hari Ini' : row.isFuture ? 'Akan Datang' : ''}
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={row.key}
                      className={`card flex items-center justify-between p-3 ${
                        row.isToday ? 'border-indigo-300 bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-bold ${row.isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                            {row.date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          {holiday && (
                            <span title={holiday.name} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-700">
                              🇮🇩 {holiday.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {row.isToday ? 'Hari Ini' : row.isFuture ? 'Akan Datang' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-sm">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">In</p>
                          <p className={`font-bold ${row.clockIn ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {stripWib(row.clockIn)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">Out</p>
                          <p className={`font-bold ${row.clockOut ? 'text-orange-500' : 'text-slate-300'}`}>
                            {stripWib(row.clockOut)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {viewMode === 'calendar' && (
            <AbsensiCalendarView
              currentUser={currentUser}
              pengajuan={pengajuan}
              selected={selected}
              setSelected={setSelected}
              getHoliday={getHoliday}
              getHolidaysForMonth={getHolidaysForMonth}
            />
          )}

          <button
            onClick={() => setSelected(null)}
            className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            Kembali ke daftar periode
          </button>
        </div>
      )}
    </div>
  )
}

const DAY_NAMES_MINI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function AbsensiCalendarView({ currentUser, pengajuan, selected, setSelected, getHoliday, getHolidaysForMonth }) {
  const month = selected.month
  const year = selected.year

  // Build pengajuan map for this month
  const pengajuanByDate = useMemo(() => {
    if (!currentUser) return new Map()
    const lastDay = new Date(year, month, 0).getDate()
    const startKey = dateToKey(new Date(year, month - 1, 1))
    const endKey = dateToKey(new Date(year, month - 1, lastDay))
    const map = new Map()
    pengajuan
      .filter((p) =>
        p.userId === currentUser.id &&
        p.status === 'approved' &&
        (p.type === 'cuti' || p.type === 'sakit') &&
        p.startDate <= endKey &&
        p.endDate >= startKey
      )
      .forEach((p) => {
        const startD = new Date(p.startDate + 'T00:00:00')
        const endD = new Date(p.endDate + 'T00:00:00')
        const cur = new Date(startD)
        while (cur <= endD) {
          const key = dateToKey(cur)
          if (!map.has(key)) map.set(key, p)
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

  const goPrev = () => {
    let newMonth = month - 1
    let newYear = year
    if (newMonth < 1) { newMonth = 12; newYear -= 1 }
    setSelected({ month: newMonth, year: newYear })
  }

  const goNext = () => {
    let newMonth = month + 1
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear += 1 }
    setSelected({ month: newMonth, year: newYear })
  }

  const todayKey = dateToKey(new Date())
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="animate-fade-in">
      {/* Header with nav */}
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
          const leave = pengajuanByDate.get(dateKey)
          const holiday = getHoliday(dateKey)

          let bgClass = ''
          let textClass = 'text-slate-700'
          let label = null
          let sublabel = null
          let titleText = null

          if (holiday) {
            bgClass = 'bg-red-100'
            textClass = 'text-red-700'
            label = '🇮🇩'
            sublabel = 'Libur'
            titleText = holiday.name
          } else if (leave?.type === 'cuti') {
            bgClass = 'bg-sky-100'
            textClass = 'text-sky-700'
            label = 'Cuti'
          } else if (leave?.type === 'sakit') {
            bgClass = 'bg-rose-100'
            textClass = 'text-rose-700'
            label = 'Sakit'
          }

          return (
            <div
              key={`day-${day}`}
              title={titleText || undefined}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition ${bgClass} ${isToday ? 'ring-2 ring-indigo-400' : 'hover:bg-slate-50'}`}
            >
              <span className={`text-sm font-bold ${textClass}`}>{day}</span>
              {label && <span className={`font-mono text-[8px] font-bold leading-none ${textClass}`}>{label}</span>}
              {sublabel && <span className={`text-[7px] font-bold uppercase tracking-wider leading-none ${textClass}`}>{sublabel}</span>}
            </div>
          )
        })}
      </div>

      {/* Informasi: Legend + Upcoming Holidays */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Informasi</span>
        </div>

        {/* Color legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-100" /><span className="text-slate-700">Cuti</span></div>
          <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-100" /><span className="text-slate-700">Sakit</span></div>
          <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100" /><span className="text-slate-700">Libur</span></div>
          <div className="flex items-center gap-1"><span className="h-3 w-3 rounded ring-2 ring-indigo-400" /><span className="text-slate-700">Hari ini</span></div>
        </div>

        {/* Holidays in the displayed month */}
        {(() => {
          const monthHolidays = getHolidaysForMonth(year, month)
          if (monthHolidays.length === 0) return null
          return (
            <div className="mt-3 border-t border-slate-100 pt-3">
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
    </div>
  )
}

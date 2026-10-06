import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../context/UsersContext'
import { useEvents } from '../context/EventsContext'
import { useHolidays } from '../context/HolidaysContext'
import Modal from '../components/Modal'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatEventDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

function formatDateRange(start, end) {
  if (!start) return '-'
  const s = formatEventDate(start)
  const e = formatEventDate(end)
  if (start === end || !end) return s
  return `${s} — ${e}`
}

function PageHeader({ title, subtitle, action }) {
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
      <div className="flex-1">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-900">Belum ada event</h3>
      <p className="mt-1 text-sm text-slate-500">Buat event pertama kamu untuk memulai.</p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Buat Event
      </button>
    </div>
  )
}

function EventCard({ event, onOpen }) {
  const { getHoliday } = useHolidays()
  const holiday = getHoliday(event.date)
  return (
    <button
      onClick={onOpen}
      className="card group flex w-full items-center gap-3 p-4 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-bold ${
            event.status === 'pending' ? 'text-amber-600' :
            event.status === 'approved' ? 'text-indigo-600' :
            'text-slate-900'
          }`}>{event.name}</p>
          {event.status === 'pending' && (
            <span className="flex-shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
              Pending
            </span>
          )}
          {event.status === 'approved' && (
            <span className="flex-shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-indigo-700">
              OK
            </span>
          )}
          {holiday && (
            <span className="flex-shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-700">
              Libur
            </span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">
          {formatDateRange(event.startDate || event.date, event.endDate)} · {event.location}
        </p>
        {holiday ? (
          <p className="mt-1 truncate text-[10px] font-bold text-red-600">{holiday.name}</p>
        ) : (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Manpower: {event.manpower?.length || 0} orang
          </p>
        )}
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

const ROLE_PRESETS = ['Sales A', 'Sales B', 'Sales C', 'Crew', 'PIC', 'PM', 'Design', 'Lembur']

function ManpowerPicker({ users, selected, onChange }) {
  const [search, setSearch] = useState('')
  const [pickedUser, setPickedUser] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [customRole, setCustomRole] = useState('')

  const filtered = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) && !selected.some((m) => m.name === u.fullName)
  )

  const toggleRole = (r) => {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  const handleAdd = () => {
    const name = pickedUser || search.trim()
    const roles = customRole.trim()
      ? [...selectedRoles, customRole.trim()]
      : selectedRoles
    if (!name || roles.length === 0) return
    onChange([...selected, { name, roles }])
    setSearch('')
    setPickedUser('')
    setSelectedRoles([])
    setCustomRole('')
  }

  return (
    <div className="space-y-3">
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Manpower</label>

      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((m, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{m.name}</p>
                <p className="text-[11px] text-indigo-600">sebagai {m.roles.join(', ')}</p>
              </div>
              <button type="button" onClick={() => onChange(selected.filter((_, j) => j !== i))} className="flex-shrink-0 rounded-full p-0.5 text-slate-300 hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPickedUser('') }}
          placeholder="Cari nama..."
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-3 focus:ring-indigo-500/10"
        />
        {search && filtered.length > 0 && !pickedUser && (
          <div className="mt-1 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { setSearch(u.fullName); setPickedUser(u.fullName); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {u.fullName}
                <span className="text-[10px] text-slate-400">@{u.username}</span>
              </button>
            ))}
          </div>
        )}
        {search && filtered.length === 0 && !pickedUser && (
          <p className="mt-1 text-xs text-slate-400">Tidak ada karyawan ditemukan</p>
        )}
      </div>

      {pickedUser && (
        <>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">Sebagai</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_PRESETS.map((r) => {
                const active = selectedRoles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      active
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="block flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/10"
                placeholder="Atau ketik role lain..."
              />
              {customRole.trim() && (
                <span className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  +{customRole.trim()}
                </span>
              )}
            </div>
            {selectedRoles.length > 0 && (
              <p className="mt-1.5 text-[11px] text-indigo-600">
                Dipilih: {selectedRoles.join(', ')}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedRoles.length && !customRole.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
          >
            + Tambah {pickedUser}
          </button>
        </>
      )}
    </div>
  )
}

function formatRupiah(num) {
  if (num == null || Number.isNaN(num)) return 'Rp 0'
  return 'Rp ' + Number(num).toLocaleString('id-ID')
}

function parseRupiah(str) {
  if (!str) return 0
  const cleaned = str.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function CreateEventForm({ onSubmit, onCancel, users }) {
  const { computePOCategory, poThresholds } = useEvents()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [location, setLocation] = useState('')
  const [manpower, setManpower] = useState([])
  const [poRaw, setPoRaw] = useState('')
  const [error, setError] = useState('')

  const poAmount = parseInt(poRaw, 10) || 0
  const poDisplay = poRaw ? 'Rp ' + Number(poRaw).toLocaleString('id-ID') : ''
  const poCategory = useMemo(() => computePOCategory(poAmount), [poAmount, computePOCategory])

  const CATEGORY_LABEL = { kecil: 'Event Kecil', menengah: 'Event Menengah', besar: 'Event Besar' }
  const CATEGORY_COLOR = {
    kecil: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    menengah: 'border-amber-200 bg-amber-50 text-amber-700',
    besar: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !startDate || !location.trim()) {
      setError('Semua field wajib diisi.')
      return
    }
    onSubmit({ name, startDate, endDate: endDate || startDate, location, manpower, poAmount })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="event-name" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Nama Event
        </label>
        <input
          id="event-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Contoh: Bazaar Ramadhan"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="event-start-date" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Tanggal Mulai
        </label>
        <input
          id="event-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
      </div>
      <div>
        <label htmlFor="event-end-date" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Tanggal Selesai
        </label>
        <input
          id="event-end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        <p className="mt-1 text-[10px] text-slate-400">Kosongi jika 1 hari saja</p>
      </div>
      <div>
        <label htmlFor="event-location" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Lokasi Event
        </label>
        <input
          id="event-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Contoh: Mall XYZ Lt. 2"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Nilai PO
        </label>
        <input
          type="text"
          value={poDisplay}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '')
            setPoRaw(digits)
          }}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Rp 0"
        />
        {poAmount > 0 && poCategory && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CATEGORY_COLOR[poCategory]}`}>
              {CATEGORY_LABEL[poCategory]}
            </span>
            <span className="text-[11px] text-slate-400">{formatRupiah(poAmount)}</span>
          </div>
        )}
      </div>

      <ManpowerPicker users={users} selected={manpower} onChange={setManpower} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
        >
          Batal
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
        >
          Buat Event
        </button>
      </div>
    </form>
  )
}

export default function EventsPage() {
  const { currentUser } = useAuth()
  const { users } = useUsers()
  const { events, createEvent } = useEvents()
  const { getHoliday } = useHolidays()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('upcoming')

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const baseEvents = useMemo(() => {
    return [...events]
      .filter((e) => e.status === 'approved' || (e.status === 'pending' && (e.createdBy === currentUser?.fullName || e.createdBy === currentUser?.id || e.createdBy === currentUser?.username)))
  }, [events, currentUser])

  const upcomingEvents = useMemo(() => {
    return baseEvents
      .filter((e) => (e.endDate || e.startDate || e.date) >= todayStr)
      .sort((a, b) => {
        const aDate = a.startDate || a.date
        const bDate = b.startDate || b.date
        if (aDate === bDate) return (b.createdAt || '').localeCompare(a.createdAt || '')
        return aDate.localeCompare(bDate)
      })
  }, [baseEvents, todayStr])

  const pastEvents = useMemo(() => {
    return baseEvents
      .filter((e) => (e.endDate || e.startDate || e.date) < todayStr)
      .sort((a, b) => {
        const aDate = a.endDate || a.startDate || a.date
        const bDate = b.endDate || b.startDate || b.date
        if (aDate === bDate) return (b.createdAt || '').localeCompare(a.createdAt || '')
        return bDate.localeCompare(aDate)
      })
  }, [baseEvents, todayStr])

  const activeEvents = tab === 'upcoming' ? upcomingEvents : pastEvents

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeEvents
    return activeEvents.filter((e) =>
      [e.name, e.location, e.startDate || e.date].some((f) => String(f || '').toLowerCase().includes(q))
    )
  }, [activeEvents, search])

  const handleCreate = async (payload) => {
    const status = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' ? 'approved' : 'pending'
    const newEvent = await createEvent({ ...payload, createdBy: currentUser?.fullName || 'Anonim', status })
    setOpen(false)
    navigate(`/events/${newEvent.id}`)
  }

  const totalCount = baseEvents.length

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader
        title="Event"
        subtitle="Semua event yang tersedia"
        action={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat
          </button>
        }
      />

      {events.length > 0 && (
        <>
          <div className="relative mb-3 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Cari nama, lokasi, tanggal..."
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="mb-4 flex gap-2 animate-fade-in">
            <button
              onClick={() => setTab('upcoming')}
              className={`flex-1 rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition active:scale-95 ${
                tab === 'upcoming'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Akan Datang ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setTab('past')}
              className={`flex-1 rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition active:scale-95 ${
                tab === 'past'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Selesai ({pastEvents.length})
            </button>
          </div>
        </>
      )}

      {events.length === 0 ? (
        <EmptyState onCreate={() => setOpen(true)} />
      ) : filteredEvents.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Tidak ada event yang cocok dengan "{search}".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onOpen={() => navigate(`/events/${event.id}`)}
            />
          ))}
        </div>
      )}

      <Modal open={open} title="Buat Event Baru" onClose={() => setOpen(false)}>
        <CreateEventForm onSubmit={handleCreate} onCancel={() => setOpen(false)} users={users} />
      </Modal>
    </div>
  )
}

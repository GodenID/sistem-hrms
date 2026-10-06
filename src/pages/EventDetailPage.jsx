import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../context/UsersContext'
import { useEvents } from '../context/EventsContext'
import Modal from '../components/Modal'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const ROLE_PRESETS = ['Sales A', 'Sales B', 'Sales C', 'Crew', 'PIC', 'PM', 'Design', 'Lembur']

function formatRupiah(num) {
  if (num == null || Number.isNaN(num)) return 'Rp 0'
  return 'Rp ' + Number(num).toLocaleString('id-ID')
}

function parseRupiah(str) {
  if (!str) return 0
  const cleaned = str.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const CATEGORY_LABEL = { kecil: 'Event Kecil', menengah: 'Event Menengah', besar: 'Event Besar' }
const CATEGORY_COLOR = {
  kecil: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  menengah: 'border-amber-200 bg-amber-50 text-amber-700',
  besar: 'border-rose-200 bg-rose-50 text-rose-700',
}

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

function getInitial(name) {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-5 flex items-center gap-3 animate-fade-in">
      <Link
        to="/events"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
        aria-label="Kembali"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <div className="flex-1 min-w-0">
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function AddManpowerModal({ users, open, onClose, onAdd }) {
  const [search, setSearch] = useState('')
  const [pickedUser, setPickedUser] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [customRole, setCustomRole] = useState('')

  const filtered = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase())
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
    onAdd({ name, roles })
    setSearch('')
    setPickedUser('')
    setSelectedRoles([])
    setCustomRole('')
  }

  return (
    <Modal open={open} title="Tambah Manpower" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPickedUser('') }}
            placeholder="Cari nama..."
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
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
              <label className="mb-1.5 block text-xs font-bold text-slate-500">Sebagai</label>
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
                  className="block flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Atau ketik role lain..."
                />
                {customRole.trim() && (
                  <span className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                    +{customRole.trim()}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedRoles.length && !customRole.trim()}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
            >
              Tambah
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { users } = useUsers()
  const { getEventById, updateEvent } = useEvents()
  const [open, setOpen] = useState(false)
  const [addCostOpen, setAddCostOpen] = useState(false)
  const [costDesc, setCostDesc] = useState('')
  const [costInput, setCostInput] = useState('')

  const event = useMemo(() => getEventById(id), [getEventById, id])
  const creatorName = useMemo(() => {
    if (!event?.createdBy) return 'Anonim'
    const raw = String(event.createdBy)
    if (raw.startsWith('usr_')) {
      const u = users.find((x) => x.id === raw)
      return u?.fullName || u?.username || raw
    }
    const byUsername = users.find((x) => x.username === raw)
    if (byUsername) return byUsername.fullName || raw
    const byId = users.find((x) => x.id === raw)
    if (byId) return byId.fullName || raw
    return raw
  }, [event?.createdBy, users])

  if (!event) {
    return (
      <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
        <PageHeader title="Event Tidak Ditemukan" />
        <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0l-7.1 12.25A2 2 0 005 19z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">Event tidak tersedia</h3>
          <p className="mt-1 text-sm text-slate-500">Mungkin event sudah dihapus atau ID tidak valid.</p>
          <button
            onClick={() => navigate('/events')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Kembali ke daftar event
          </button>
        </div>
      </div>
    )
  }

  const manpower = event.manpower || []

  const handleAddManpower = (entry) => {
    updateEvent(event.id, { manpower: [...manpower, entry] })
    setOpen(false)
  }

  const handleAddCost = () => {
    const amount = parseInt(costInput, 10) || 0
    if (!costDesc.trim() || !amount) return
    const newCost = { id: generateId('ac'), description: costDesc.trim(), amount }
    const existing = event.additionalCosts || []
    updateEvent(event.id, { additionalCosts: [...existing, newCost] })
    setCostDesc('')
    setCostInput('')
    setAddCostOpen(false)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader title={event.name} subtitle={formatDateRange(event.startDate || event.date, event.endDate)} />

      <div className="card mb-5 overflow-hidden p-5 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className={`truncate text-base font-bold ${
                event.status === 'pending' ? 'text-amber-600' :
                event.status === 'approved' ? 'text-indigo-600' :
                'text-slate-900'
              }`}>{event.name}</h2>
              {event.status === 'pending' && (
                <span className="flex-shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
              )}
              {event.status === 'approved' && (
                <span className="flex-shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Disetujui</span>
              )}
              {event.status === 'rejected' && (
                <span className="flex-shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Ditolak</span>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateRange(event.startDate || event.date, event.endDate)}
              </p>
              <p className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.location}
              </p>
              <p className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Dibuat oleh {creatorName}
              </p>
              {event.poAmount > 0 && (
                <p className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-slate-800">{formatRupiah(event.poAmount)}</span>
                  {event.poCategory && (
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CATEGORY_COLOR[event.poCategory]}`}>
                      {CATEGORY_LABEL[event.poCategory]}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {(event.additionalCosts?.length > 0 || event.poAmount > 0) && (
        <div className="card mb-5 overflow-hidden p-5 animate-slide-up">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Informasi Biaya</h3>
            {event.status !== 'pending' && (
              <button
                onClick={() => setAddCostOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah Additional
              </button>
            )}
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            {event.poAmount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
                <span className="font-medium text-slate-700">Nilai PO</span>
                <span className="font-bold text-slate-900">{formatRupiah(event.poAmount)}</span>
              </div>
            )}
            {(event.additionalCosts || []).map((ac, i) => (
              <div key={ac.id || i} className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                <span className="font-medium text-slate-700">{ac.description}</span>
                <span className="font-bold text-indigo-700">{formatRupiah(ac.amount)}</span>
              </div>
            ))}
            {(event.additionalCosts?.length > 0) && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                <span className="font-bold text-slate-900">
                  {formatRupiah((event.poAmount || 0) + (event.additionalCosts || []).reduce((s, c) => s + (c.amount || 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between animate-slide-up" style={{ animationDelay: '0.03s' }}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Manpower</h3>
          <p className="text-xs text-slate-500">{manpower.length} orang</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={event.status === 'pending'}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] ${
            event.status === 'pending'
              ? 'cursor-not-allowed bg-slate-300 shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tambah
        </button>
      </div>

      {event.status === 'pending' && manpower.length === 0 && (
        <div className="card flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-amber-700">Event masih pending</p>
          <p className="mt-1 text-xs text-amber-600">Tunggu persetujuan admin sebelum menambah manpower.</p>
        </div>
      )}

      {event.status !== 'pending' && manpower.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h2a4 4 0 014 4v2zm5-12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-900">Belum ada manpower</p>
          <p className="mt-1 text-xs text-slate-500">Tambahkan manpower untuk event ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {manpower.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-extrabold text-indigo-600">
                {getInitial(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">
                  sebagai
                  <span className="font-semibold text-indigo-600"> {Array.isArray(m.roles) ? m.roles.join(', ') : m.role || ''}</span>
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">#{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <AddManpowerModal
        users={users}
        open={open}
        onClose={() => setOpen(false)}
        onAdd={handleAddManpower}
      />

      <Modal open={addCostOpen} title="Tambah Biaya Tambahan" onClose={() => { setAddCostOpen(false); setCostDesc(''); setCostInput('') }}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500">Deskripsi</label>
            <input
              type="text"
              value={costDesc}
              onChange={(e) => setCostDesc(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Contoh: Sewa Sound System"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500">Nominal</label>
            <input
              type="text"
              value={costInput ? 'Rp ' + Number(costInput).toLocaleString('id-ID') : ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, '')
                setCostInput(digits)
              }}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Rp 0"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCost}
            disabled={!costDesc.trim() || !parseInt(costInput, 10)}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
          >
            Tambah
          </button>
        </div>
      </Modal>
    </div>
  )
}

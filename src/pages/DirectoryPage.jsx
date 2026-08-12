import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

function RoleBadge({ role }) {
  if (role === 'admin') {
    return <span className="chip border border-violet-200 bg-violet-50 text-violet-700"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Admin</span>
  }
  return <span className="chip border border-slate-200 bg-slate-50 text-slate-600">Karyawan</span>
}

function UserDetailModal({ user, onClose }) {
  if (!user) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-mobile overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex flex-col items-center text-center">
          <Avatar name={user.fullName} color={user.avatarColor} photo={user.photo} size="lg" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">{user.fullName}</h3>
          <p className="font-mono text-xs text-slate-500">@{user.username}</p>
          <div className="mt-2"><RoleBadge role={user.role} /></div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <DetailRow label="NIK" value={user.nik || '—'} mono />
          <DetailRow label="Divisi" value={user.division || '—'} />
          <DetailRow label="Role" value={user.role === 'admin' ? 'Administrator' : 'Karyawan'} />
          <DetailRow label="Bergabung" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
          Tutup
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function DirectoryPage() {
  const { users, currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [division, setDivision] = useState('all')
  const [selected, setSelected] = useState(null)

  // Build division list from users
  const divisions = useMemo(() => {
    const set = new Set()
    users.forEach((u) => { if (u.division) set.add(u.division) })
    return ['all', ...Array.from(set).sort()]
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => division === 'all' || u.division === division)
      .filter((u) => {
        if (!q) return true
        return [u.fullName, u.username, u.division, u.nik].some((f) => String(f || '').toLowerCase().includes(q))
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
  }, [users, search, division])

  const divisionLabel = (d) => d === 'all' ? 'Semua' : d

  return (
    <div className="relative flex min-h-full items-start justify-center overflow-hidden bg-white px-5 py-6">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
      <div className="animate-blob-a pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-200/45 via-indigo-200/30 to-transparent blur-3xl" aria-hidden="true" />
      <div className="animate-blob-b pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-200/40 via-cyan-200/30 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-mobile animate-slide-up">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3 animate-fade-in">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 backdrop-blur-sm transition hover:bg-white active:scale-95" aria-label="Kembali">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              <span className="italic">Direktori</span>{' '}
              <span className="text-indigo-600">Karyawan</span>
            </h1>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{users.length} orang terdaftar</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Cari nama, username, NIK..."
          />
        </div>

        {/* Division chips */}
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {divisions.map((d) => {
            const active = division === d
            const count = d === 'all' ? users.length : users.filter((u) => u.division === d).length
            return (
              <button
                key={d}
                onClick={() => setDivision(d)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {divisionLabel(d)} <span className={`ml-1 font-mono text-[10px] ${active ? 'opacity-90' : 'text-slate-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.map((u) => {
            const isMe = u.id === currentUser?.id
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
              >
                <Avatar name={u.fullName} color={u.avatarColor} photo={u.photo} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{u.fullName}</p>
                    {isMe && <span className="flex-shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-indigo-700">Kamu</span>}
                  </div>
                  <p className="truncate font-mono text-[11px] text-slate-500">@{u.username} · {u.division || '—'}</p>
                </div>
                {u.role === 'admin' && (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="card flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Tidak ada karyawan yang cocok dengan filter.</p>
            </div>
          )}
        </div>
      </div>

      <UserDetailModal user={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

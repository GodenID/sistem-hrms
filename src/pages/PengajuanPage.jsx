import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLeave } from '../context/LeaveContext'
import { usePengajuan, calculateLeaveDays } from '../context/PengajuanContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'

const STATUS_LABEL = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
]

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-center gap-3 animate-fade-in">
      <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95" aria-label="Kembali">
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

function StatusBadge({ status }) {
  return <span className={`chip border ${STATUS_STYLE[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{STATUS_LABEL[status]}</span>
}

function EmptyState({ onCreate, isFiltered }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-900">{isFiltered ? 'Tidak ada hasil' : 'Belum ada pengajuan'}</h3>
      <p className="mt-1 text-sm text-slate-500">{isFiltered ? 'Coba ubah filter atau kata kunci pencarian.' : 'Buat pengajuan cuti, izin, atau lembur pertama Anda.'}</p>
      {!isFiltered && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Buat Pengajuan
        </button>
      )}
    </div>
  )
}

function CreatePengajuanForm({ onSubmit, onCancel, initialType }) {
  const { types } = usePengajuan()
  const { currentUser } = useAuth()
  const { getLeaveBalance } = useLeave()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState(initialType || types[0]?.id || '')
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [clockInTime, setClockInTime] = useState('09:00')
  const [clockOutTime, setClockOutTime] = useState('17:00')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Saldo cuti tahun ini (reactive)
  const currentYear = new Date().getFullYear()
  const balance = currentUser ? getLeaveBalance(currentUser.id, currentYear) : null
  const requestedDays = startDate && endDate && endDate >= startDate
    ? calculateLeaveDays(startDate, endDate)
    : 0
  const isCutiOverLimit = type === 'cuti' && balance && requestedDays > balance.remaining
  const sisaSetelah = balance ? Math.max(0, balance.remaining - requestedDays) : 0

  const isKoreksi = type === 'koreksi'
  const isLembur = type === 'lembur'
  const showTimeInputs = isKoreksi || isLembur

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!type || !startDate || !endDate) { setError('Semua field wajib diisi.'); return }
    if (endDate < startDate) { setError('Tanggal selesai harus setelah tanggal mulai.'); return }
    if (!reason.trim()) { setError('Alasan wajib diisi.'); return }
    if (type === 'cuti' && balance && requestedDays > balance.remaining) {
      setError(`Saldo cuti tidak cukup. Sisa ${balance.remaining} hari, diminta ${requestedDays} hari (kurang ${requestedDays - balance.remaining} hari). Kurangi tanggal pengajuan.`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await onSubmit({ type, startDate, endDate, reason, clockInTime, clockOutTime })
      if (res && !res.ok && res.error) setError(res.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Jenis Pengajuan</label>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {showTimeInputs ? (
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tanggal</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value) }} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Mulai</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Selesai</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          </div>
        </div>
      )}

      {showTimeInputs && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{isLembur ? 'Jam Mulai' : 'Jam Masuk'}</label>
            <input type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{isLembur ? 'Jam Selesai' : 'Jam Pulang'}</label>
            <input type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          </div>
        </div>
      )}

      {/* Saldo Cuti indicator — only for cuti type */}
      {type === 'cuti' && balance && (
        <div className={`rounded-xl border p-3 ${isCutiOverLimit ? 'border-rose-200 bg-rose-50/50' : 'border-sky-200 bg-sky-50/50'}`}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Saldo Cuti {currentYear}</span>
            <span className="font-mono text-[10px] font-bold text-slate-700">{balance.remaining} / {balance.totalQuota} hari tersisa</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-slate-600">Diminta:</span>
            <span className={`font-bold ${isCutiOverLimit ? 'text-rose-700' : 'text-sky-700'}`}>{requestedDays} hari</span>
            <span className="text-slate-300">→</span>
            <span className="text-slate-600">Sisa:</span>
            <span className={`font-bold ${isCutiOverLimit ? 'text-rose-700' : 'text-emerald-700'}`}>{sisaSetelah} hari</span>
            {isCutiOverLimit && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Kurang {requestedDays - balance.remaining} hari
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Alasan</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="block w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Jelaskan alasan pengajuan Anda..." />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-xs font-medium text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50">Batal</button>
        <button type="submit" disabled={isCutiOverLimit || submitting} className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
          <span className="relative flex items-center justify-center gap-2">
            {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {submitting ? 'Mengirim...' : 'Kirim'}
          </span>
        </button>
      </div>
    </form>
  )
}

function formatDateRange(start, end) {
  if (start === end) {
    return new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const s = new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const e = new Date(end + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

export default function PengajuanPage() {
  const { currentUser } = useAuth()
  const { pengajuan, createPengajuan, types } = usePengajuan()
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [initialType, setInitialType] = useState('')
  const [pengajuanPage, setPengajuanPage] = useState(1)
  const PENGAJUAN_PAGE_SIZE = 10

  // Filter to current user's pengajuan only
  const myPengajuan = useMemo(() => {
    if (!currentUser) return []
    return pengajuan.filter((p) => p.userId === currentUser.id)
  }, [pengajuan, currentUser])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return myPengajuan
      .filter((p) => filter === 'all' || p.status === filter)
      .filter((p) => {
        if (!q) return true
        const typeLabel = types.find((t) => t.id === p.type)?.label || ''
        return [typeLabel, p.reason, p.startDate, p.endDate].some((f) => String(f || '').toLowerCase().includes(q))
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [myPengajuan, filter, search, types])

  const paginatedPengajuan = useMemo(() => {
    const totalPages = Math.ceil(filtered.length / PENGAJUAN_PAGE_SIZE)
    const safePage = Math.min(pengajuanPage, Math.max(1, totalPages))
    return {
      items: filtered.slice((safePage - 1) * PENGAJUAN_PAGE_SIZE, safePage * PENGAJUAN_PAGE_SIZE),
      totalPages,
      page: safePage,
    }
  }, [filtered, pengajuanPage])

  const typeLabel = (id) => types.find((t) => t.id === id)?.label || id

  const handleSubmit = async (payload) => {
    const result = await createPengajuan(payload)
    if (result.ok) {
      setModal(false)
      toast.success('Pengajuan berhasil dikirim! Menunggu persetujuan admin.')
    } else {
      toast.error(result.error || 'Gagal mengirim pengajuan')
    }
    return result
  }

  const openCreate = (typeId = '') => {
    setInitialType(typeId)
    setModal(true)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader
        title="Pengajuan"
        subtitle="Cuti, izin, dan pengajuan lainnya"
        action={
          <button
            onClick={() => openCreate()}
            className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-3 animate-fade-in">
        <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPengajuanPage(1) }}
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Cari jenis, alasan, tanggal..."
        />
      </div>

      {/* Filter chips */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id
          const count = f.id === 'all' ? myPengajuan.length : myPengajuan.filter((p) => p.status === f.id).length
          return (
            <button
              key={f.id}
               onClick={() => { setFilter(f.id); setPengajuanPage(1) }}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {f.label} <span className={`ml-1 font-mono text-[10px] ${active ? 'opacity-90' : 'text-slate-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {myPengajuan.length === 0 ? (
        <EmptyState onCreate={() => openCreate()} />
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Tidak ada pengajuan yang cocok.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedPengajuan.items.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{typeLabel(p.type)}</p>
                    <p className="font-mono text-[11px] text-slate-500">{formatDateRange(p.startDate, p.endDate)}</p>
                    {p.type === 'koreksi' && p.clockInTime && (
                      <p className="mt-0.5 font-mono text-[11px] text-indigo-600">{p.clockInTime} – {p.clockOutTime} WIB</p>
                    )}
                    {p.type === 'lembur' && p.clockInTime && (
                      <p className="mt-0.5 font-mono text-[11px] text-indigo-600">Lembur {p.clockInTime} – {p.clockOutTime} WIB</p>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.reason && <p className="mt-2 text-xs leading-relaxed text-slate-600">"{p.reason}"</p>}
                {p.rejectionReason && (
                  <p className="mt-2 text-xs leading-relaxed text-rose-600">Ditolak: "{p.rejectionReason}"</p>
                )}
                {p.reviewedByName && (
                  <p className="mt-2 border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-400">
                    {p.status === 'approved' ? 'Disetujui' : 'Ditolak'} oleh <span className="font-bold text-slate-600">{p.reviewedByName}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Pagination page={paginatedPengajuan.page} totalPages={paginatedPengajuan.totalPages} onPageChange={setPengajuanPage} />
          </div>
        </>
      )}

      <Modal open={modal} title="Buat Pengajuan Baru" onClose={() => setModal(false)}>
        <CreatePengajuanForm onSubmit={handleSubmit} onCancel={() => setModal(false)} initialType={initialType} />
      </Modal>
    </div>
  )
}

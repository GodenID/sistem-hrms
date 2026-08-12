import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClock } from '../context/ClockContext'
import { useEvents } from '../context/EventsContext'
import { usePengajuan } from '../context/PengajuanContext'
import { useAnnouncements } from '../context/AnnouncementsContext'
import { useHolidays } from '../context/HolidaysContext'
import { useNotifications } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import Pagination from '../components/Pagination'
import { exportAbsensiToExcel, exportEventsToExcel } from '../utils/excelExport'
import { sexLabel } from '../services/diditOcr'
import {
  validateUsername,
  validatePassword,
  validateFullName,
  validateKtp,
  validateBirthPlace,
  validateBirthDate,
  validateSex,
  validateAddress,
  validateDivision,
  DIVISION_OPTIONS,
} from '../utils/validation'
import LocationsTab from '../components/LocationsTab'
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatEventDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function formatDateRange(start, end) {
  if (!start) return '-'
  const s = formatEventDate(start)
  const e = formatEventDate(end)
  if (start === end || !end) return s
  return `${s} — ${e}`
}
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import Avatar from '../components/Avatar'

const TABS = [
  { id: 'users', label: 'Karyawan' },
  { id: 'kpi', label: 'OKR' },
  { id: 'pengajuan', label: 'Pengajuan' },
  { id: 'absensi', label: 'Absensi' },
  { id: 'events', label: 'Event' },
  { id: 'pengumuman', label: 'Info' },
  { id: 'libur', label: 'Libur' },
  { id: 'lokasi', label: 'Lokasi' },
]

// ============================================================
// STATS CARDS (top of AdminPage)
// ============================================================
function StatsCards() {
  const { users } = useAuth()
  const { pengajuan } = usePengajuan()
  const { events } = useEvents()
  const { getUpcomingHolidays } = useHolidays()

  const pendingCount = pengajuan.filter((p) => p.status === 'pending').length
  const adminCount = users.filter((u) => u.role === 'admin').length

  const now = new Date()
  const eventsThisMonth = events.filter((e) => {
    if (!e.date) return false
    const d = new Date(e.date + 'T00:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const upcomingHolidays = getUpcomingHolidays(3).filter((h) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const hDate = new Date(h.date + 'T00:00:00')
    const diffDays = Math.ceil((hDate - today) / (1000 * 60 * 60 * 24))
    return diffDays <= 14
  }).length

  const stats = [
    {
      label: 'Pengajuan',
      sublabel: 'menunggu',
      value: pendingCount,
      accent: 'amber',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Event',
      sublabel: 'bulan ini',
      value: eventsThisMonth,
      accent: 'indigo',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Karyawan',
      sublabel: 'total',
      value: users.length,
      accent: 'sky',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Admin',
      sublabel: 'aktif',
      value: adminCount,
      accent: 'violet',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 animate-slide-up">
      {stats.map((s) => (
        <div key={s.label} className="card p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className="font-mono text-[9px] text-slate-400">{s.sublabel}</p>
            </div>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${s.accent}-50 text-${s.accent}-600`}>
              {s.icon}
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return <span className="chip border border-violet-200 bg-violet-50 text-violet-700"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Admin</span>
  }
  return <span className="chip border border-slate-200 bg-slate-50 text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Karyawan</span>
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Menunggu', cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    approved: { label: 'Disetujui', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    rejected: { label: 'Ditolak', cls: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  }
  const s = map[status] || map.pending
  return <span className={`chip ${s.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
}

// ============================================================
// USERS TAB
// ============================================================
const USERS_PAGE_SIZE = 20

function UsersTab() {
  const { users, updateUser, setUserRole, currentUser, register, adjustLeaveQuota, getLeaveBalance, setLeaveQuota } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [pendingRoleToggle, setPendingRoleToggle] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [creating, setCreating] = useState(false)
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false)
  const [userPage, setUserPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.fullName, u.username, u.division, u.nik].some((f) => String(f || '').toLowerCase().includes(q))
    )
  }, [users, search])

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users])

  const paginatedUsers = useMemo(() => {
    const totalPages = Math.ceil(filtered.length / USERS_PAGE_SIZE)
    const safePage = Math.min(userPage, Math.max(1, totalPages))
    return {
      items: filtered.slice((safePage - 1) * USERS_PAGE_SIZE, safePage * USERS_PAGE_SIZE),
      totalPages,
      page: safePage,
    }
  }, [filtered, userPage])

  const handleSave = async (partial, quota) => {
    const result = await updateUser(editing.id, partial)
    if (result.ok) {
      if (quota !== null && quota !== undefined) {
        const year = new Date().getFullYear()
        await setLeaveQuota(editing.id, year, quota)
      }
      setEditing(null)
      toast.success(`Data ${editing.fullName || editing.username} berhasil diperbarui.`)
    }
    return result
  }

  const requestToggleRole = (u) => {
    if (u.id === currentUser?.id) return
    // Anti-lockout: cannot demote the last remaining admin
    if (u.role === 'admin' && adminCount <= 1) return
    setPendingRoleToggle(u)
  }

  const confirmToggleRole = async () => {
    if (!pendingRoleToggle) return
    const wasAdmin = pendingRoleToggle.role === 'admin'
    await setUserRole(pendingRoleToggle.id, wasAdmin ? 'employee' : 'admin')
    setPendingRoleToggle(null)
    toast.success(`${pendingRoleToggle.fullName} sekarang ${wasAdmin ? 'Karyawan' : 'Admin'}.`)
  }

  const isLastAdmin = pendingRoleToggle?.role === 'admin' && adminCount <= 1
  const isPromote = pendingRoleToggle?.role === 'employee'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setUserPage(1) }}
            className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Cari nama, username, NIK, divisi..."
          />
        </div>
        <button
          type="button"
          onClick={() => setBulkAdjustOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 active:scale-[0.97]"
          title="Penyesuaian saldo cuti massal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
          Saldo
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.97]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tambah
        </button>
      </div>

      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">{filtered.length} karyawan</p>

      <div className="space-y-2">
        {paginatedUsers.items.map((u) => (
          <div
            key={u.id}
            onClick={() => setSelectedUser(u)}
            className="card flex cursor-pointer items-center gap-3 p-3 transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
          >
            <Avatar name={u.fullName} color={u.avatarColor} photo={u.photo} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-slate-900">{u.fullName}</p>
                <RoleBadge role={u.role} />
              </div>
              <p className="truncate font-mono text-[11px] text-slate-500">@{u.username}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                <span>NIK: <span className="font-mono font-medium text-slate-700">{u.nik || '—'}</span></span>
                <span>Div: <span className="font-medium text-slate-700">{u.division || '—'}</span></span>
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setEditing(u)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
              >
                Edit
              </button>
              <button
                onClick={() => requestToggleRole(u)}
                disabled={u.id === currentUser?.id || (u.role === 'admin' && adminCount <= 1)}
                className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  u.id === currentUser?.id
                    ? 'Anda tidak dapat mengubah role sendiri'
                    : u.role === 'admin' && adminCount <= 1
                    ? 'Tidak dapat demote admin terakhir'
                    : ''
                }
              >
                {u.role === 'admin' ? '→ Karyawan' : '→ Admin'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-slate-500">Tidak ada karyawan yang cocok.</p>
          </div>
        )}
      </div>

      <Pagination page={paginatedUsers.page} totalPages={paginatedUsers.totalPages} onPageChange={setUserPage} />

      {editing && (
        <EditUserModal
          user={editing}
          balance={getLeaveBalance(editing.id, new Date().getFullYear())}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreate={async ({ fullName, username, password, ktp, birthPlace, birthDate, sex, address, division, role }) => {
            const result = await register({ fullName, username, password, ktp, birthPlace, birthDate, sex, address, division, role, ktpVerified: false })
            if (result.ok) {
              setCreating(false)
              toast.success(`Akun ${fullName} (@${username}) berhasil dibuat.`)
              return { ok: true }
            }
            return result
          }}
        />
      )}

      {bulkAdjustOpen && (
        <BulkAdjustQuotaModal
          users={filtered}
          onClose={() => setBulkAdjustOpen(false)}
          onConfirm={async ({ userIds, year, startDate, endDate, days, reason }) => {
            const result = await adjustLeaveQuota({
              userIds,
              year,
              startDate,
              endDate,
              days,
              reason,
              adjustedBy: currentUser?.fullName || currentUser?.username || 'Admin',
            })
            if (result.ok) {
              setBulkAdjustOpen(false)
              toast.success(`Saldo cuti ${result.count} karyawan berhasil disesuaikan (${days} hari, ${reason}).`)
            }
            return result
          }}
          getLeaveBalance={getLeaveBalance}
        />
      )}

      <ConfirmModal
        open={!!pendingRoleToggle}
        onClose={() => setPendingRoleToggle(null)}
        onConfirm={confirmToggleRole}
        title={isPromote ? 'Promosikan ke Admin?' : 'Demote ke Karyawan?'}
        message={
          pendingRoleToggle
            ? `Anda akan mengubah role ${pendingRoleToggle.fullName || pendingRoleToggle.username} dari ${isPromote ? 'Karyawan' : 'Admin'} menjadi ${isPromote ? 'Admin' : 'Karyawan'}.`
            : ''
        }
        detail={
          isLastAdmin
            ? 'PERINGATAN: Ini adalah admin terakhir di sistem. Setelah didemote, tidak akan ada admin lain yang tersisa.'
            : isPromote
            ? 'User ini akan mendapat akses penuh ke Admin Panel, termasuk mengelola karyawan lain, approve/reject pengajuan, dan mengelola event.'
            : 'User ini akan kehilangan akses ke Admin Panel.'
        }
        confirmLabel={isPromote ? 'Promosikan' : 'Demote'}
        variant={isLastAdmin ? 'danger' : 'warning'}
      />

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

function UserDetailModal({ user, onClose }) {
  const { pengajuan, types } = usePengajuan()
  const { history } = useClock()

  const userPengajuan = useMemo(
    () => pengajuan.filter((p) => p.userId === user.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [pengajuan, user.id],
  )
  const userHistory = useMemo(
    () => history.filter((h) => h.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)),
    [history, user.id],
  )

  const typeLabel = (id) => types.find((t) => t.id === id)?.label || id
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <Modal open onClose={onClose} title="Detail Karyawan">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.fullName} color={user.avatarColor} photo={user.photo} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">{user.fullName}</p>
            <p className="font-mono text-xs text-slate-500">@{user.username}</p>
            <div className="mt-1"><RoleBadge role={user.role} /></div>
          </div>
        </div>

        <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <DetailRow label="NIK" value={user.nik || '—'} mono />
          <DetailRow label="Divisi" value={user.division || '—'} />
          <DetailRow label="Bergabung" value={joinDate} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">Pengajuan</h4>
            <span className="font-mono text-[10px] font-bold text-slate-400">{userPengajuan.length} total</span>
          </div>
          {userPengajuan.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3 text-center text-xs text-slate-500">
              Belum ada pengajuan.
            </div>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {userPengajuan.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">{typeLabel(p.type)}</p>
                    <p className="font-mono text-[10px] text-slate-500">{p.startDate}{p.startDate !== p.endDate ? ` – ${p.endDate}` : ''}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
              {userPengajuan.length > 5 && <p className="text-center font-mono text-[10px] text-slate-400">+ {userPengajuan.length - 5} lainnya</p>}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">Riwayat Absensi</h4>
            <span className="font-mono text-[10px] font-bold text-slate-400">{userHistory.length} hari</span>
          </div>
          {userHistory.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3 text-center text-xs text-slate-500">
              Belum ada data absensi.
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {userHistory.slice(0, 10).map((h) => (
                <div key={`${h.userId}-${h.date}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-slate-600">{new Date(h.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                  <span className="flex items-center gap-2 font-mono">
                    <span className="text-emerald-700">{h.clockIn || '—'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-rose-700">{h.clockOut || '—'}</span>
                  </span>
                </div>
              ))}
              {userHistory.length > 10 && <p className="text-center font-mono text-[10px] text-slate-400">+ {userHistory.length - 10} hari lainnya</p>}
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
          Tutup
        </button>
      </div>
    </Modal>
  )
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function EditUserModal({ user, balance, onSave, onClose }) {
  const [fullName, setFullName] = useState(user.fullName || '')
  const [nik, setNik] = useState(user.nik || '')
  const [division, setDivision] = useState(user.division || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [address, setAddress] = useState(user.address || '')
  const [leaveQuota, setLeaveQuota] = useState(balance?.totalQuota ?? 12)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const quotaNum = Number(leaveQuota)
    if (!Number.isFinite(quotaNum) || quotaNum < 0) {
      setError('Kuota cuti harus angka positif.')
      return
    }
    const result = onSave({
      fullName: fullName.trim(),
      nik: nik.trim(),
      division: division.trim(),
      phone: phone.trim(),
      address: address.trim(),
    }, quotaNum)
    if (result && !result.ok) setError(result.error)
  }

  return (
    <Modal open title={`Edit ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nama Lengkap</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">NIK</label>
            <input value={nik} onChange={(e) => setNik(e.target.value)} maxLength={20} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm tracking-wider transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="NIK" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Divisi</label>
            <input value={division} onChange={(e) => setDivision(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nomor HP</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="081234567890" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Alamat</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Alamat lengkap" />
        </div>
        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">Kuota Cuti Tahunan</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={365}
              value={leaveQuota}
              onChange={(e) => setLeaveQuota(e.target.value === '' ? '' : Number(e.target.value))}
              className="block w-24 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 font-mono text-sm font-bold text-center transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
            <span className="text-xs text-indigo-600 font-semibold">hari / tahun</span>
          </div>
          {balance && (
            <p className="mt-2 font-mono text-[10px] text-indigo-500">
              Saat ini: {balance.used} terpakai, {balance.remaining} sisa
            </p>
          )}
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">Batal</button>
          <button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
            <span className="relative">Simpan</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CreateUserModal({ onClose, onCreate }) {
  // Form state — admin mengetik semua data diri secara manual (untuk kasus
  // KTP rusak / tidak terbaca OCR), atau untuk mendaftarkan karyawan baru.
  const formRef = useRef(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [ktp, setKtp] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('')
  const [address, setAddress] = useState('')
  const [division, setDivision] = useState('')
  const [role, setRole] = useState('employee')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const passwordCheck = validatePassword(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = {}
    const u = validateUsername(username)
    if (!u.isValid) errs.username = u.error
    if (!passwordCheck.isStrong) errs.password = 'Password belum memenuhi syarat kekuatan.'
    if (password !== confirmPassword) errs.confirmPassword = 'Konfirmasi password tidak cocok.'
    const fn = validateFullName(fullName)
    if (!fn.isValid) errs.fullName = fn.error
    const k = validateKtp(ktp)
    if (!k.isValid) errs.ktp = k.error
    const bp = validateBirthPlace(birthPlace)
    if (!bp.isValid) errs.birthPlace = bp.error
    const bd = validateBirthDate(birthDate)
    if (!bd.isValid) errs.birthDate = bd.error
    const sx = validateSex(sex)
    if (!sx.isValid) errs.sex = sx.error
    const ad = validateAddress(address)
    if (!ad.isValid) errs.address = ad.error
    const dv = validateDivision(division)
    if (!dv.isValid) errs.division = dv.error
    if (Object.keys(errs).length > 0) {
      setError(errs)
      return
    }
    setSubmitting(true)
    const result = await onCreate({
      username: username.trim(),
      password,
      fullName: fullName.trim(),
      ktp,
      birthPlace: birthPlace.trim(),
      birthDate,
      sex,
      address: address.trim(),
      division,
      role,
    })
    setSubmitting(false)
    if (result && !result.ok) {
      // Map error ke field yang relevan (umumnya username duplikat)
      const msg = String(result.error || 'Gagal membuat user.')
      if (msg.toLowerCase().includes('username')) setError({ username: msg })
      else setError({ _form: msg })
    }
  }

  const fieldError = (key) => (error && typeof error === 'object' ? error[key] : '')
  const formError = fieldError('_form')

  // Footer selalu terlihat di bawah modal (sticky) supaya tombol Batal/Buat Akun
  // tetap reachable meskipun field form panjang dan harus di-scroll.
  const footer = (
    <div className="space-y-3">
      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {formError}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={submitting}
          className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Membuat...' : 'Buat Akun'}
        </button>
      </div>
    </div>
  )

  return (
    <Modal open title="Tambah Karyawan" onClose={onClose} footer={footer}>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-[11px] leading-relaxed text-indigo-800">
          <span className="font-bold">Untuk kasus KTP rusak / tidak terbaca OCR.</span>{' '}
          Admin mengetik seluruh data diri karyawan secara manual. Data akan tersimpan ke
          profil karyawan setelah akun dibuat.
        </p>

        {/* Akun */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Akun
          </p>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Username *</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="username unik untuk login"
              autoComplete="off"
            />
            {fieldError('username') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('username')}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Password *</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Min. 8 karakter"
                autoComplete="new-password"
              />
              {fieldError('password') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('password')}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Konfirmasi *</label>
              <input
                type="text"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Ulangi password"
                autoComplete="new-password"
              />
              {fieldError('confirmPassword') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('confirmPassword')}</p>}
            </div>
          </div>
          <p className="font-mono text-[10px] text-slate-400">
            Syarat: min. 8 karakter, huruf besar, huruf kecil, angka, karakter spesial.
          </p>
        </div>

        {/* Data Pribadi (manual) */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Data Pribadi (diinput manual oleh admin)
          </p>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nama Lengkap *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Sesuai KTP"
            />
            {fieldError('fullName') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('fullName')}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nomor KTP (NIK) *</label>
            <input
              value={ktp}
              onChange={(e) => setKtp(e.target.value.replace(/\D/g, '').slice(0, 16))}
              maxLength={16}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono tracking-wider text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="16 digit angka"
            />
            <p className="mt-1 font-mono text-[10px] text-slate-400">{ktp.length}/16 digit</p>
            {fieldError('ktp') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('ktp')}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tempat Lahir *</label>
              <input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Kota kelahiran"
              />
              {fieldError('birthPlace') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('birthPlace')}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tanggal Lahir *</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              {fieldError('birthDate') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('birthDate')}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Jenis Kelamin *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'M', label: 'Laki-laki' },
                { v: 'F', label: 'Perempuan' },
              ].map((opt) => {
                const active = sex === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setSex(opt.v)}
                    className={[
                      'rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-[0.98]',
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_0_0_4px_rgba(99,102,241,0.10)]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {fieldError('sex') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('sex')}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Alamat *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Alamat lengkap sesuai KTP"
            />
            {fieldError('address') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('address')}</p>}
          </div>
        </div>

        {/* Kepegawaian */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Informasi Kepegawaian
          </p>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Divisi *</label>
            <div className="relative">
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="">Pilih divisi...</option>
                {DIVISION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {fieldError('division') && <p className="mt-1 text-[11px] font-medium text-red-600">{fieldError('division')}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'employee', label: 'Karyawan' },
                { v: 'admin', label: 'Admin' },
              ].map((opt) => {
                const active = role === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRole(opt.v)}
                    className={[
                      'rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-[0.98]',
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_0_0_4px_rgba(99,102,241,0.10)]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 font-mono text-[10px] text-slate-400">
              NIK (Nomor Induk Karyawan) dapat diisi nanti lewat tombol Edit.
            </p>
          </div>
        </div>

      </form>
    </Modal>
  )
}

// ============================================================
// PENGAJUAN TAB
// ============================================================
const PENGAJUAN_FILTERS = [
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'all', label: 'Semua' },
]

function Checkbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${checked ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
    >
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

function PengajuanTab() {
  const { pengajuan, updateStatus, types } = usePengajuan()
  const { currentUser, users, getUserById } = useAuth()
  const { setClockRecord, pendingClocks, approvePendingClock, rejectPendingClock } = useClock()
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [confirmAction, setConfirmAction] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [pengajuanPage, setPengajuanPage] = useState(1)
  const PENGAJUAN_PAGE_SIZE = 20

  const filtered = useMemo(() => {
    let list = pengajuan
    if (filter !== 'all') list = list.filter((p) => p.status === filter)
    if (dateStart) list = list.filter((p) => p.startDate >= dateStart)
    if (dateEnd) list = list.filter((p) => p.endDate <= dateEnd)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const tlabel = types.find((t) => t.id === p.type)?.label || ''
        return [p.fullName, p.username, tlabel, p.reason, p.startDate, p.endDate, p.clockInTime, p.clockOutTime].some((f) => String(f || '').toLowerCase().includes(q))
      })
    }
    return list
  }, [pengajuan, filter, search, types, dateStart, dateEnd])

  const paginatedPengajuan = useMemo(() => {
    const totalPages = Math.ceil(filtered.length / PENGAJUAN_PAGE_SIZE)
    const safePage = Math.min(pengajuanPage, Math.max(1, totalPages))
    return {
      items: filtered.slice((safePage - 1) * PENGAJUAN_PAGE_SIZE, safePage * PENGAJUAN_PAGE_SIZE),
      totalPages,
      page: safePage,
    }
  }, [filtered, pengajuanPage])

  const pendingFiltered = useMemo(() => filtered.filter((p) => p.status === 'pending'), [filtered])
  const allSelected = pendingFiltered.length > 0 && pendingFiltered.every((p) => selected.has(p.id))
  const someSelected = selected.size > 0

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(pendingFiltered.map((p) => p.id)))
  }

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter)
    setSelected(new Set())
    setPengajuanPage(1)
  }

  const doApprove = (p) => {
    updateStatus(p.id, 'approved', currentUser)
    if (p.type === 'koreksi' && p.clockInTime && p.clockOutTime) {
      const clockIn = `${p.clockInTime}:00 WIB`
      const clockOut = `${p.clockOutTime}:00 WIB`
      setClockRecord(p.userId, p.startDate, clockIn, clockOut)
    }
  }

  const handleBulkApprove = () => {
    setRejectReason('')
    setConfirmAction({ type: 'approve', mode: 'bulk' })
  }

  const handleBulkReject = () => {
    setRejectReason('')
    setConfirmAction({ type: 'reject', mode: 'bulk' })
  }

  const handleSingleApprove = (id) => {
    setConfirmAction({ type: 'approve', mode: 'single', id })
  }

  const handleSingleReject = (id) => {
    setRejectReason('')
    setConfirmAction({ type: 'reject', mode: 'single', id })
  }

  const executeApprove = () => {
    if (!confirmAction) return
    const ids = confirmAction.mode === 'bulk' ? Array.from(selected) : [confirmAction.id]
    ids.forEach((id) => {
      const p = pengajuan.find((x) => x.id === id)
      if (p) doApprove(p)
    })
    if (confirmAction.mode === 'bulk') setSelected(new Set())
    setConfirmAction(null)
  }

  const executeReject = () => {
    if (!confirmAction) return
    const ids = confirmAction.mode === 'bulk' ? Array.from(selected) : [confirmAction.id]
    ids.forEach((id) => updateStatus(id, 'rejected', currentUser, rejectReason.trim() || undefined))
    if (confirmAction.mode === 'bulk') setSelected(new Set())
    setConfirmAction(null)
    setRejectReason('')
  }

  const typeLabel = (id) => types.find((t) => t.id === id)?.label || id
  const dateRange = (start, end) => {
    if (start === end) return new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    const s = new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    const e = new Date(end + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${s} – ${e}`
  }

  const pendingClockList = pendingClocks.filter((p) => p.status === 'pending')

  return (
    <div className="space-y-3">
      {pendingClockList.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Pending Absen Luar Radius</p>
          <div className="space-y-2">
            {pendingClockList.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{pc.fullName || pc.username}</p>
                  <p className="font-mono text-[11px] text-amber-600">
                    {pc.type === 'clockIn' ? 'Clock In' : 'Clock Out'} — {new Date(pc.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {pc.time}
                  </p>
                  {pc.reason && <p className="mt-0.5 text-[11px] italic text-slate-500">&ldquo;{pc.reason}&rdquo;</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => rejectPendingClock(pc.id)} className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 active:scale-[0.98]">Tolak</button>
                  <button onClick={() => approvePendingClock(pc.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]">Setujui</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {PENGAJUAN_FILTERS.map((f) => {
          const count = f.id === 'all' ? pengajuan.length : pengajuan.filter((p) => p.status === f.id).length
          const active = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {f.label} <span className={`ml-1 font-mono text-[10px] ${active ? 'opacity-90' : 'text-slate-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPengajuanPage(1) }}
            className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Cari nama, jenis, alasan..."
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="date"
            value={dateStart}
            onChange={(e) => { setDateStart(e.target.value); setPengajuanPage(1) }}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            title="Filter tanggal mulai"
          />
        </div>
        <span className="flex items-center text-xs text-slate-400">–</span>
        <div className="flex-1">
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => { setDateEnd(e.target.value); setPengajuanPage(1) }}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            title="Filter tanggal selesai"
          />
        </div>
        {(dateStart || dateEnd) && (
          <button
            onClick={() => { setDateStart(''); setDateEnd('') }}
            className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
            title="Hapus filter tanggal"
          >
            ✕
          </button>
        )}
      </div>

      {filter === 'pending' && pendingFiltered.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-bold text-slate-700 transition hover:text-indigo-600">
            <Checkbox checked={allSelected} onChange={toggleSelectAll} label="Pilih semua" />
            {allSelected ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
          {someSelected && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-600">{selected.size} dipilih</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {paginatedPengajuan.items.map((p) => {
          const requester = getUserById(p.userId) || users.find((u) => u.id === p.userId)
          const isSelected = selected.has(p.id)
          return (
            <div key={p.id} className={`card p-4 transition ${isSelected ? 'ring-2 ring-indigo-400 border-indigo-200' : ''}`}>
              <div className="flex items-start gap-3">
                {p.status === 'pending' && (
                  <div className="pt-1">
                    <Checkbox checked={isSelected} onChange={() => toggleSelect(p.id)} label="Pilih" />
                  </div>
                )}
                <Avatar name={p.fullName || p.username} color={requester?.avatarColor} photo={requester?.photo} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{p.fullName || p.username}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{typeLabel(p.type)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{dateRange(p.startDate, p.endDate)}</p>
                  {p.type === 'koreksi' && p.clockInTime && (
                    <p className="mt-0.5 font-mono text-[11px] text-indigo-600">
                      {p.clockInTime} – {p.clockOutTime} WIB
                    </p>
                  )}
                  {p.type === 'lembur' && p.clockInTime && (
                    <p className="mt-0.5 font-mono text-[11px] text-indigo-600">
                      Lembur {p.clockInTime} – {p.clockOutTime} WIB
                    </p>
                  )}
                  {p.reason && <p className="mt-1 text-xs leading-relaxed text-slate-500">"{p.reason}"</p>}
                  {p.rejectionReason && (
                    <p className="mt-1 text-xs leading-relaxed text-rose-600">Ditolak: "{p.rejectionReason}"</p>
                  )}
                  {p.reviewedByName && (
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      oleh {p.reviewedByName} · {new Date(p.reviewedAt).toLocaleDateString('id-ID')}
                    </p>
                  )}
                </div>
              </div>
              {p.status === 'pending' && !isSelected && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleSingleReject(p.id)} className="flex-1 rounded-xl border border-rose-200 bg-white py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 active:scale-[0.99]">Tolak</button>
                  <button onClick={() => handleSingleApprove(p.id)} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]">
                    Setujui
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-slate-500">Tidak ada pengajuan {filter !== 'all' ? `berstatus "${PENGAJUAN_FILTERS.find(f=>f.id===filter)?.label}"` : ''}{search ? ' yang cocok dengan pencarian' : ''}.</p>
          </div>
        )}
      </div>

      {someSelected && (
        <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.15)] animate-slide-up">
          <span className="ml-2 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
            {selected.size} dipilih
          </span>
          <div className="flex flex-1 gap-2">
            <button onClick={handleBulkReject} className="flex-1 rounded-xl border border-rose-200 bg-white py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 active:scale-[0.99]">
              Tolak
            </button>
            <button onClick={handleBulkApprove} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]">
              Setujui
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Batal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <Pagination page={paginatedPengajuan.page} totalPages={paginatedPengajuan.totalPages} onPageChange={setPengajuanPage} />

      {confirmAction && (
        <ConfirmModal
          open
          onClose={() => { setConfirmAction(null); setRejectReason('') }}
          onConfirm={confirmAction.type === 'approve' ? executeApprove : executeReject}
          title={confirmAction.type === 'approve' ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?'}
          message={
            confirmAction.type === 'approve'
              ? `${confirmAction.mode === 'bulk' ? `${selected.size} pengajuan` : 'Pengajuan ini'} akan disetujui.`
              : `${confirmAction.mode === 'bulk' ? `${selected.size} pengajuan` : 'Pengajuan ini'} akan ditolak.`
          }
          confirmLabel={confirmAction.type === 'approve' ? 'Setujui' : 'Tolak'}
          variant={confirmAction.type === 'approve' ? 'default' : 'danger'}
          detail={
            confirmAction.type === 'reject' ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Alasan Penolakan (opsional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Contoh: Cuti tidak sesuai kuota, dokumen belum lengkap..."
                />
              </div>
            ) : null
          }
        />
      )}
    </div>
  )
}

// ============================================================
// ABSENSI TAB
// ============================================================
function AbsensiTab() {
  const { history } = useClock()
  const { users, getUserById } = useAuth()
  const { pengajuan } = usePengajuan()
  const [search, setSearch] = useState('')
  const today = new Date()
  const [exportMonth, setExportMonth] = useState(today.getMonth() + 1)
  const [exportYear, setExportYear] = useState(today.getFullYear())

  // Group history by userId
  const grouped = useMemo(() => {
    const map = new Map()
    for (const h of history) {
      const key = h.userId || 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(h)
    }
    // sort each by date desc
    for (const list of map.values()) {
      list.sort((a, b) => b.date.localeCompare(a.date))
    }
    return map
  }, [history])

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    const entries = Array.from(grouped.entries())
    if (!q) return entries
    return entries.filter(([userId, records]) => {
      const u = getUserById(userId)
      return [u?.fullName, u?.username, u?.division, records[0]?.username].some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [grouped, search, getUserById])

  const totalRecords = history.length
  const totalDays = new Set(history.map((h) => h.date)).size
  const uniqueUsers = grouped.size

  const handleExportAbsensi = () => {
    const q = search.trim().toLowerCase()
    const exportUsers = q
      ? users.filter((u) => [u.fullName, u.username, u.division].some((f) => String(f || '').toLowerCase().includes(q)))
      : users
    exportAbsensiToExcel({
      users: exportUsers,
      history,
      pengajuan,
      month: exportMonth,
      year: exportYear,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">📊 Rekap</span>
        <select value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-400 focus:outline-none">
          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-400 focus:outline-none">
          {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="text-[10px] font-medium text-slate-500">
          {`26 ${MONTH_SHORT[exportMonth - 1]} – 25 ${MONTH_SHORT[exportMonth % 12]} ${exportMonth === 12 ? exportYear + 1 : exportYear}`}
        </span>
        <button onClick={handleExportAbsensi} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      <div className="card grid grid-cols-3 divide-x divide-slate-200 p-0">
        <div className="px-3 py-3 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="mt-0.5 text-xl font-extrabold text-slate-900">{totalRecords}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Hari</p>
          <p className="mt-0.5 text-xl font-extrabold text-slate-900">{totalDays}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">User</p>
          <p className="mt-0.5 text-xl font-extrabold text-slate-900">{uniqueUsers}</p>
        </div>
      </div>

      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Cari nama, username, divisi..."
        />
      </div>

      <div className="space-y-2">
        {filteredEntries.map(([userId, records]) => {
          const u = getUserById(userId)
          const completedDays = records.filter((r) => r.clockIn && r.clockOut).length
          return (
            <details key={userId} className="card overflow-hidden">
              <summary className="flex cursor-pointer items-center gap-3 p-3">
                <Avatar name={u?.fullName || records[0]?.username || 'Unknown'} color={u?.avatarColor} photo={u?.photo} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{u?.fullName || records[0]?.username || 'Unknown'}</p>
                  <p className="font-mono text-[10px] text-slate-400">@{u?.username || records[0]?.username || 'unknown'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{records.length}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">{completedDays} complete</p>
                </div>
              </summary>
              <div className="border-t border-slate-100 px-3 py-2">
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {records.slice(0, 20).map((r) => (
                    <div key={`${r.userId}-${r.date}`} className="flex items-center justify-between rounded-lg bg-slate-50/60 px-2.5 py-1.5 text-xs">
                      <span className="font-mono text-slate-600">{r.date}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-700">{r.clockIn || '—'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-rose-700">{r.clockOut || '—'}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {records.length > 20 && <p className="mt-1 text-center font-mono text-[10px] text-slate-400">+ {records.length - 20} lainnya</p>}
              </div>
            </details>
          )
        })}
        {grouped.size === 0 && (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-slate-500">Belum ada data absensi.</p>
          </div>
        )}
        {grouped.size > 0 && filteredEntries.length === 0 && (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-slate-500">Tidak ada karyawan yang cocok dengan "{search}".</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// EVENTS TAB
// ============================================================
function EventsTab() {
  const { events, createEvent, updateEvent, deleteEvent, poThresholds, setPOThresholds } = useEvents()
  const { currentUser } = useAuth()
  const toast = useToast()
  const [modal, setModal] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const today = new Date()
  const [exportMonth, setExportMonth] = useState(today.getMonth() + 1)
  const [exportYear, setExportYear] = useState(today.getFullYear())
  const [showPOCfg, setShowPOCfg] = useState(false)
  const [poCfgKecil, setPOCfgKecil] = useState(String(poThresholds?.kecilMax || 50000000))
  const [poCfgMenengah, setPOCfgMenengah] = useState(String(poThresholds?.menengahMax || 200000000))

  const handleExportEvents = () => {
    exportEventsToExcel({
      events,
      vouchers: [],
      month: exportMonth,
      year: exportYear,
    })
  }

  const handleApprove = (id) => {
    updateEvent(id, { status: 'approved' })
    toast.success('Event telah disetujui')
  }

  const handleReject = (id) => {
    updateEvent(id, { status: 'rejected' })
    toast.success('Event telah ditolak')
  }

  const STATUS_STYLES = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  const filtered = statusFilter === 'all' ? events : events.filter((e) => e.status === statusFilter)

  return (
    <div className="space-y-3">
      <button
        onClick={() => setModal({ mode: 'create' })}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Buat Event Baru
      </button>

      {/* PO Category Settings */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          onClick={() => setShowPOCfg(!showPOCfg)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Kategori PO</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition ${showPOCfg ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPOCfg && (
          <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
            <p className="text-[11px] text-slate-500">Atur batas nominal untuk kategori event berdasarkan nilai PO.</p>
            <div className="flex items-center gap-2">
              <label className="w-24 text-[11px] font-bold text-slate-600">Event Kecil</label>
              <input
                type="text"
                value={poCfgKecil ? 'Rp ' + Number(poCfgKecil.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                onChange={(e) => setPOCfgKecil(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs transition focus:border-indigo-400 focus:outline-none focus:ring-3 focus:ring-indigo-500/10"
                placeholder="Rp 0"
              />
              <span className="text-[10px] text-slate-400">s.d.</span>
              <input
                type="text"
                value={poCfgMenengah ? 'Rp ' + Number(poCfgMenengah.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                onChange={(e) => setPOCfgMenengah(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs transition focus:border-indigo-400 focus:outline-none focus:ring-3 focus:ring-indigo-500/10"
                placeholder="Rp 0"
              />
              <span className="text-[10px] text-slate-400">ke atas</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">Kecil</span>
              <span>≤ <span className="font-mono">{poCfgKecil ? 'Rp ' + Number(poCfgKecil.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : 'Rp 0'}</span></span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700">Menengah</span>
              <span>≤ <span className="font-mono">{poCfgMenengah ? 'Rp ' + Number(poCfgMenengah.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : 'Rp 0'}</span></span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-bold text-rose-700">Besar</span>
            </div>
            <button
              onClick={() => {
                const kecil = parseInt(poCfgKecil.replace(/[^0-9]/g, ''), 10) || 0
                const menengah = parseInt(poCfgMenengah.replace(/[^0-9]/g, ''), 10) || 0
                if (kecil > 0 && menengah > kecil) {
                  setPOThresholds({ kecilMax: kecil, menengahMax: menengah })
                  toast.success('Kategori PO berhasil disimpan')
                } else {
                  toast.error('Nilai tidak valid. Pastikan Kecil < Menengah')
                }
              }}
              className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
            >
              Simpan
            </button>
          </div>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
              statusFilter === s
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {s === 'all' ? 'Semua' : s}
          </button>
        ))}
      </div>

      {/* Export */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">📅 Export</span>
        <select value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-400 focus:outline-none">
          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-400 focus:outline-none">
          {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={handleExportEvents} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className="card p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{e.name}</p>
                  <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[e.status] || STATUS_STYLES.pending}`}>
                    {e.status || 'pending'}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-500">{formatDateRange(e.startDate || e.date, e.endDate)} · {e.location}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">{e.manpower?.length || 0} orang</p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1.5">
                {e.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(e.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95">Setuju</button>
                    <button onClick={() => handleReject(e.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95">Tolak</button>
                  </>
                )}
                {e.status !== 'pending' && (
                  <>
                    <button onClick={() => setModal({ mode: 'edit', event: e })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95">Edit</button>
                    <button onClick={() => setModal({ mode: 'delete', event: e })} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95">Hapus</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-slate-500">Belum ada event.</p>
          </div>
        )}
      </div>

      {modal?.mode === 'create' && (
        <EventFormModal
          title="Buat Event Baru"
          onCancel={() => setModal(null)}
          onSubmit={(payload) => {
            createEvent({ ...payload, createdBy: currentUser?.fullName || 'Anonim', status: 'approved' })
            setModal(null)
          }}
        />
      )}
      {modal?.mode === 'edit' && (
        <EventFormModal
          title={`Edit: ${modal.event.name}`}
          initial={modal.event}
          onCancel={() => setModal(null)}
          onSubmit={(payload) => {
            updateEvent(modal.event.id, payload)
            setModal(null)
          }}
        />
      )}
      {modal?.mode === 'delete' && (
        <ConfirmModal
          open
          onClose={() => setModal(null)}
          onConfirm={() => { deleteEvent(modal.event.id); setModal(null) }}
          title="Hapus Event?"
          message={`Event "${modal.event.name}" akan dihapus beserta semua data manpower.`}
          detail="Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Hapus Event"
          variant="danger"
        />
      )}
    </div>
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
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Manpower</label>

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

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPickedUser('') }}
          placeholder="Cari nama..."
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-3 focus:ring-indigo-500/10"
        />
        {search && filtered.length > 0 && !pickedUser && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
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

function EventFormModal({ title, initial, onSubmit, onCancel }) {
  const { users } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState(initial?.name || '')
  const [startDate, setStartDate] = useState(initial?.startDate || initial?.date || todayStr)
  const [endDate, setEndDate] = useState(initial?.endDate || initial?.startDate || initial?.date || todayStr)
  const [location, setLocation] = useState(initial?.location || '')
  const [manpower, setManpower] = useState(initial?.manpower || [])
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !startDate || !location.trim()) {
      setError('Semua field wajib diisi.')
      return
    }
    onSubmit({ name, startDate, endDate: endDate || startDate, location, manpower })
  }

  return (
    <Modal open title={title} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nama Event</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Contoh: Bazaar Ramadhan" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tanggal Mulai</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tanggal Selesai</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
          <p className="mt-1 text-[10px] text-slate-400">Kosongi jika 1 hari</p>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Lokasi</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Contoh: Mall XYZ Lt. 2" />
        </div>
        <ManpowerPicker users={users} selected={manpower} onChange={setManpower} />
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">Batal</button>
          <button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
            <span className="relative">{initial ? 'Simpan' : 'Buat'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// ANNOUNCEMENTS TAB
// ============================================================
const TYPE_BADGE_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  important: 'border-amber-200 bg-amber-50 text-amber-700',
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000))
  if (diff < 60) return 'baru saja'
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function AnnouncementsTab() {
  const { announcements, createAnnouncement, updateAnnouncement, deleteAnnouncement, types, typeMeta } = useAnnouncements()
  const [modal, setModal] = useState(null) // null | { mode: 'create' } | { mode: 'edit', item }
  const [deleting, setDeleting] = useState(null)

  const handleSave = (payload) => {
    if (modal?.mode === 'create') createAnnouncement(payload)
    else if (modal?.mode === 'edit') updateAnnouncement(modal.item.id, payload)
    setModal(null)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setModal({ mode: 'create' })}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        Buat Pengumuman
      </button>

      <div className="space-y-2">
        {announcements.map((a) => {
          const meta = typeMeta(a.type)
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
                  {meta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{a.title}</p>
                    <span className={`chip border ${TYPE_BADGE_STYLES[a.type] || TYPE_BADGE_STYLES.info}`}>{meta.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{a.body}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-slate-400">
                    oleh {a.createdByName} · {timeAgo(a.createdAt)}{a.updatedAt ? ` · diedit ${timeAgo(a.updatedAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => setModal({ mode: 'edit', item: a })}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleting(a)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {announcements.length === 0 && (
          <div className="card flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
              📢
            </div>
            <h3 className="text-base font-bold text-slate-900">Belum ada pengumuman</h3>
            <p className="mt-1 text-sm text-slate-500">Buat pengumuman pertama untuk menginformasikan sesuatu ke seluruh karyawan.</p>
          </div>
        )}
      </div>

      {modal && (
        <AnnouncementFormModal
          title={modal.mode === 'create' ? 'Buat Pengumuman' : 'Edit Pengumuman'}
          initial={modal.mode === 'edit' ? modal.item : null}
          types={types}
          typeMeta={typeMeta}
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => { deleteAnnouncement(deleting.id); setDeleting(null) }}
          title="Hapus Pengumuman?"
          message={`Pengumuman "${deleting.title}" akan dihapus.`}
          detail="Tindakan ini tidak dapat dibatalkan. Semua notifikasi terkait pengumuman ini akan ikut terhapus."
          confirmLabel="Hapus Pengumuman"
          variant="danger"
        />
      )}
    </div>
  )
}

function AnnouncementFormModal({ title, initial, types, typeMeta, onSave, onCancel }) {
  const [annType, setAnnType] = useState(initial?.type || 'info')
  const [annTitle, setAnnTitle] = useState(initial?.title || '')
  const [annBody, setAnnBody] = useState(initial?.body || '')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!annTitle.trim() || !annBody.trim()) {
      setError('Judul dan isi pengumuman wajib diisi.')
      return
    }
    onSave({ type: annType, title: annTitle, body: annBody })
  }

  return (
    <Modal open onClose={onCancel} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tipe Pengumuman</label>
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => {
              const active = annType === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAnnType(t.id)}
                  className={`rounded-xl border px-2 py-2.5 text-center transition ${active ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="text-xl">{t.emoji}</div>
                  <div className={`mt-1 text-[11px] font-bold ${active ? 'text-indigo-700' : 'text-slate-600'}`}>{t.label}</div>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label htmlFor="ann-title" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Judul</label>
          <input
            id="ann-title"
            type="text"
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            autoFocus
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Contoh: Jadwal Libur Lebaran 2026"
          />
        </div>
        <div>
          <label htmlFor="ann-body" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Isi Pengumuman</label>
          <textarea
            id="ann-body"
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            rows={5}
            className="block w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder={'Baris 1\n\nBaris 3 (paragraf baru)\n  Indentasi 2 spasi'}
          />
          <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-slate-400">
            <span className="font-bold text-slate-500">Formatting:</span> Enter = baris baru · Enter 2x = paragraf baru · Spasi ganda = indentasi
          </p>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">Batal</button>
          <button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
            {initial ? 'Simpan' : 'Publish'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// HOLIDAYS TAB
// ============================================================
const HOLIDAY_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'nasional', label: 'Nasional' },
  { id: 'custom', label: 'Custom' },
  { id: 'upcoming', label: 'Akan Datang' },
]

function HolidaysTab() {
  const { allHolidays, createCustom, updateCustom, deleteCustom, formatHolidayDate, categoryLabel, categoryColor } = useHolidays()
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null) // null | { mode: 'create' } | { mode: 'edit', item }
  const [deleting, setDeleting] = useState(null)

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (filter === 'nasional') return allHolidays.filter((h) => !h.isCustom)
    if (filter === 'custom') return allHolidays.filter((h) => h.isCustom)
    if (filter === 'upcoming') return allHolidays.filter((h) => h.date >= today)
    return allHolidays
  }, [allHolidays, filter])

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      all: allHolidays.length,
      nasional: allHolidays.filter((h) => !h.isCustom).length,
      custom: allHolidays.filter((h) => h.isCustom).length,
      upcoming: allHolidays.filter((h) => h.date >= today).length,
    }
  }, [allHolidays])

  const handleSave = (payload) => {
    if (modal?.mode === 'create') createCustom(payload)
    else if (modal?.mode === 'edit') updateCustom(modal.item.id, payload)
    setModal(null)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setModal({ mode: 'create' })}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Tambah Hari Libur
      </button>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {HOLIDAY_FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {f.label} <span className={`ml-1 font-mono text-[10px] ${active ? 'opacity-90' : 'text-slate-400'}`}>{counts[f.id]}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((h) => {
          const d = new Date(h.date + 'T00:00:00')
          const dayNum = d.getDate()
          const monthAbbr = d.toLocaleDateString('id-ID', { month: 'short' })
          return (
            <div key={h.id || h.date} className="card flex items-center gap-3 p-3">
              <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50">
                <span className="font-mono text-[8px] font-bold uppercase leading-none text-slate-500">{monthAbbr}</span>
                <span className="mt-0.5 font-mono text-base font-extrabold leading-none text-slate-900">{dayNum}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{h.name}</p>
                <p className="font-mono text-[10px] text-slate-500">{formatHolidayDate(h.date)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className={`chip border ${categoryColor[h.category] || categoryColor.nasional}`}>{categoryLabel[h.category] || h.category}</span>
                  {h.isCustom && (
                    <span className="chip border border-violet-200 bg-violet-50 text-violet-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Custom
                    </span>
                  )}
                </div>
              </div>
              {h.isCustom && (
                <div className="flex flex-shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => setModal({ mode: 'edit', item: h })}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleting(h)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
              📅
            </div>
            <h3 className="text-base font-bold text-slate-900">Tidak ada hari libur</h3>
            <p className="mt-1 text-sm text-slate-500">
              {filter === 'custom' ? 'Belum ada hari libur custom.' : filter === 'upcoming' ? 'Tidak ada hari libur dalam waktu dekat.' : 'Belum ada data.'}
            </p>
          </div>
        )}
      </div>

      {modal && (
        <HolidayFormModal
          title={modal.mode === 'create' ? 'Tambah Hari Libur' : 'Edit Hari Libur'}
          initial={modal.mode === 'edit' ? modal.item : null}
          categoryLabel={categoryLabel}
          categoryColor={categoryColor}
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => { deleteCustom(deleting.id); setDeleting(null) }}
          title="Hapus Hari Libur Custom?"
          message={`Hari libur "${deleting.name}" pada tanggal ${new Date(deleting.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} akan dihapus.`}
          detail="Tindakan ini tidak dapat dibatalkan. Hari libur nasional bawaan (dari pemerintah) tidak akan terpengaruh."
          confirmLabel="Hapus"
          variant="danger"
        />
      )}
    </div>
  )
}

function HolidayFormModal({ title, initial, categoryLabel, categoryColor, onSave, onCancel }) {
  const [holDate, setHolDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
  const [holName, setHolName] = useState(initial?.name || '')
  const [holCategory, setHolCategory] = useState(initial?.category || 'nasional')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!holDate || !holName.trim()) {
      setError('Tanggal dan nama wajib diisi.')
      return
    }
    onSave({ date: holDate, name: holName, category: holCategory })
  }

  const categories = Object.keys(categoryLabel || {})

  return (
    <Modal open onClose={onCancel} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="hol-date" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tanggal</label>
          <input
            id="hol-date"
            type="date"
            value={holDate}
            onChange={(e) => setHolDate(e.target.value)}
            autoFocus
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <div>
          <label htmlFor="hol-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Nama Hari Libur</label>
          <input
            id="hol-name"
            type="text"
            value={holName}
            onChange={(e) => setHolName(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Contoh: Cuti Bersama Lebaran"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Kategori</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => {
              const active = holCategory === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setHolCategory(c)}
                  className={`rounded-xl border px-2 py-2 text-center transition ${active ? `border-indigo-400 ring-2 ring-indigo-500/15 ${categoryColor[c]}` : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className={`text-[11px] font-bold ${active ? '' : 'text-slate-600'}`}>{categoryLabel[c]}</div>
                </button>
              )
            })}
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">Batal</button>
          <button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
            {initial ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// BULK ADJUST SALDO CUTI — modal untuk admin
// ============================================================
function BulkAdjustQuotaModal({ users, onClose, onConfirm, getLeaveBalance }) {
  const currentYear = new Date().getFullYear()
  const [selected, setSelected] = useState(new Set())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  // Auto-calculate days (inklusif) dari rentang tanggal.
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    if (end < start) return 0
    return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.fullName, u.username, u.division].some((f) => String(f || '').toLowerCase().includes(q))
    )
  }, [users, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id))
  const someSelected = filtered.some((u) => selected.has(u.id))

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((u) => u.id)))
    }
  }

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Preview dampak: tambahkan `days` ke `used` per selected user.
  const preview = useMemo(() => {
    if (!days) return null
    const list = []
    for (const u of users) {
      if (!selected.has(u.id)) continue
      const balance = getLeaveBalance(u.id, currentYear)
      const totalQuota = balance?.totalQuota ?? 12
      const currentUsed = balance?.used ?? 0
      const newUsed = currentUsed + days
      const remaining = Math.max(0, totalQuota - newUsed)
      list.push({ id: u.id, name: u.fullName, currentUsed, newUsed, remaining, totalQuota })
    }
    return list
  }, [users, selected, days, getLeaveBalance, currentYear])

  const handleConfirm = async () => {
    setError('')
    if (selected.size === 0) {
      setError('Pilih minimal satu karyawan.')
      return
    }
    if (!startDate || !endDate) {
      setError('Pilih tanggal mulai dan tanggal selesai.')
      return
    }
    if (days <= 0) {
      setError('Tanggal selesai harus setelah atau sama dengan tanggal mulai.')
      return
    }
    if (!reason.trim()) {
      setError('Alasan penyesuaian wajib diisi.')
      return
    }
    setSubmitting(true)
    const result = await onConfirm({
      userIds: Array.from(selected),
      year: currentYear,
      startDate,
      endDate,
      days,
      reason: reason.trim(),
    })
    setSubmitting(false)
    if (result && !result.ok) {
      setError(result.error || 'Gagal menyimpan.')
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting || selected.size === 0 || !days}
        className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? 'Menyimpan...' : `Simpan (${selected.size})`}
      </button>
    </div>
  )

  return (
    <Modal open title="Penyesuaian Saldo Cuti Massal" onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <p className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          <span className="font-bold">Cuti bersama:</span> tambahkan hari terpakai untuk banyak karyawan sekaligus berdasarkan rentang tanggal. Setiap perubahan akan tercatat di riwayat cuti masing-masing karyawan.
        </p>

        {/* Tahun + Tanggal Mulai + Tanggal Selesai + Reason */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Tahun
            </label>
            <input
              type="text"
              value={currentYear}
              readOnly
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
          </div>
          {days > 0 && (
            <p className="font-mono text-[10px] text-slate-400">
              {days} hari kerja (terhitung inklusif)
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Alasan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Cuti bersama Lebaran, Natal, dll"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
        </div>

        {/* Preview dampak (hanya muncul saat days > 0) */}
        {preview && preview.length > 0 && (
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              Preview Dampak ({preview.length} karyawan)
            </p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {preview.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-slate-700">{p.name}</span>
                  <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                    terpakai {p.currentUsed} → {p.newUsed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, username, divisi..."
            className="block w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>

        {/* Select all + counter */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
          >
            {allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
          {someSelected && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              {selected.size} dipilih
            </span>
          )}
        </div>

        {/* Employee list with checkboxes + current quota */}
        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-400">
              Tidak ada karyawan yang cocok dengan pencarian.
            </p>
          ) : filtered.map((u) => {
            const isSelected = selected.has(u.id)
            const balance = getLeaveBalance(u.id, currentYear)
            const quota = balance?.totalQuota ?? 12
            const used = balance?.used ?? 0
            return (
              <label
                key={u.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition ${isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-white'}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(u.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-4 focus:ring-indigo-500/20"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{u.fullName}</p>
                  <p className="truncate text-[11px] text-slate-500">{u.division || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] font-bold text-slate-700">{quota - used}/{quota}</p>
                  <p className="font-mono text-[9px] text-slate-400">sisa/total</p>
                </div>
              </label>
            )
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}


// ============================================================
// OKR TAB — membuka Sistem OKR (native, tanpa iframe/SSO)
// ============================================================

function OkrTab() {
  const { currentUser } = useAuth()

  return (
    <div className="card animate-fade-in p-6">
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Sistem OKR</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Masuk sebagai {currentUser?.fullName || currentUser?.username} — tanpa login ulang
          </p>
        </div>
        <Link
          to="/okr"
          className="mt-1 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
        >
          Buka Sistem OKR
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function AdminPage() {
  const [tab, setTab] = useState('users')

  // View mode toggle: 'mobile' (default, constrained to phone width) atau
  // 'desktop' (full width, lebih lapang). Preferensi disimpan di localStorage.
  const [viewMode, setViewMode] = useState(() => {
    if (typeof localStorage === 'undefined') return 'mobile'
    return localStorage.getItem('hrms_admin_view_mode') || 'mobile'
  })

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hrms_admin_view_mode', viewMode)
    }
  }, [viewMode])

  const isMobileView = viewMode === 'mobile'

  return (
    <div
      className={[
        'relative flex min-h-full items-start justify-center overflow-hidden px-5 py-6 transition-colors',
        isMobileView ? 'bg-white' : 'bg-slate-200',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
      <div className="animate-blob-a pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-violet-200/45 via-fuchsia-200/30 to-transparent blur-3xl" aria-hidden="true" />
      <div className="animate-blob-b pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/45 via-violet-200/30 to-transparent blur-3xl" aria-hidden="true" />

      <div
        className={[
          'relative w-full animate-slide-up transition-all',
          isMobileView
            ? 'max-w-mobile'
            : 'max-w-7xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 sm:p-6',
        ].join(' ')}
      >
        {/* Header */}
        <div className="mb-5 flex items-center gap-3 animate-fade-in">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 backdrop-blur-sm transition hover:bg-white active:scale-95" aria-label="Kembali">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight text-slate-900">
                <span className="italic">Admin</span>{' '}
                <span className="text-indigo-600">Panel</span>
              </h1>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Prasasti Group HRMS</p>
            </div>
          </div>

          {/* View mode toggle — hanya untuk admin panel */}
          <div className="ml-auto flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              aria-pressed={isMobileView}
              className={[
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                isMobileView ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
              title="Tampilan mobile (lebar phone)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setViewMode('desktop')}
              aria-pressed={!isMobileView}
              className={[
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                !isMobileView ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
              title="Tampilan desktop (lebar penuh)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Desktop
            </button>
          </div>
        </div>

        {/* Indikator mode (hanya muncul di mobile view supaya admin tidak lupa) */}
        {isMobileView && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>
              Mode <span className="font-bold">Mobile Preview</span> — tampilan dibatasi selebar phone. Toggle ke Desktop di kanan atas untuk lihat versi lebar.
            </span>
          </div>
        )}

        {/* Stats cards */}
        <StatsCards />

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-white/70 p-1 backdrop-blur-sm">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`min-w-[64px] flex-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {tab === 'users' && <UsersTab />}
        {tab === 'kpi' && <OkrTab />}
        {tab === 'pengajuan' && <PengajuanTab />}
        {tab === 'absensi' && <AbsensiTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'pengumuman' && <AnnouncementsTab />}
        {tab === 'libur' && <HolidaysTab />}
        {tab === 'lokasi' && <LocationsTab />}
      </div>
    </div>
  )
}


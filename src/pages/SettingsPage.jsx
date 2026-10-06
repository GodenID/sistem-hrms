import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../context/UsersContext'
import { useLeave } from '../context/LeaveContext'
import { usePengajuan, calculateLeaveDays } from '../context/PengajuanContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import Avatar from '../components/Avatar'
import { maskKtp, validatePassword, formatTgl, validatePhone, validatePersonalEmail, validateEmergencyContactName } from '../utils/validation'
import { useToast } from '../context/ToastContext'
import { sexLabel } from '../services/diditOcr'
import {
  getPermissionStatus as getBrowserPermissionStatus,
  requestPermission as requestBrowserPermission,
  PREF_STORAGE_KEY,
} from '../utils/browserNotifications'
import { hardRefreshPWA } from '../utils/location'
import {
  enablePush,
  disablePush,
  getPushSubscription,
  testPush,
  pushSupported,
} from '../services/push'

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

function InfoRow({ icon, label, value, mono = false, badge = null }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          {badge}
        </div>
        <p className={`mt-0.5 text-sm font-semibold text-slate-900 break-words ${mono ? 'font-mono' : ''}`}>
          {value || '-'}
        </p>
      </div>
    </div>
  )
}

function formatJoinDate(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function PasswordStrengthMeter({ score, maxScore }) {
  const labels = ['Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
  const color = colors[Math.min(score, colors.length - 1)]
  const label = labels[Math.min(score, labels.length - 1)]
  const percent = Math.max(8, (score / maxScore) * 100)
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}

function ChangePasswordSection() {
  const { changePassword } = useAuth()
  const toast = useToast()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const passwordCheck = validatePassword(newPassword)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!oldPassword) { setError('Password lama wajib diisi.'); return }
    if (!passwordCheck.isStrong) { setError('Password baru belum memenuhi syarat kekuatan.'); return }
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return }

    setSubmitting(true)
    try {
      const result = await changePassword(oldPassword, newPassword)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Password berhasil diperbarui.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div id="keamanan" className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Ganti Password</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="old-password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Password Lama</label>
          <div className="relative">
            <input
              id="old-password"
              type={show ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-4 pr-16 text-sm text-slate-900 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Password saat ini"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-4 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700">
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Password Baru</label>
          <input
            id="new-password"
            type={show ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-900 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Minimal 8 karakter"
          />
          {newPassword && <PasswordStrengthMeter score={passwordCheck.score} maxScore={passwordCheck.maxScore} />}
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Konfirmasi Password Baru</label>
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-900 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Ulangi password baru"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-xs font-medium text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98] disabled:opacity-70"
        >
          <span className="relative">
            {submitting ? 'Menyimpan...' : 'Perbarui Password'}
          </span>
        </button>
      </form>
    </div>
  )
}

export default function SettingsPage() {
  const { currentUser, logout } = useAuth()
  const { getLeaveBalance, getLeaveAdjustments } = useLeave()
  const { updateUser } = useUsers()
  const { pengajuan } = usePengajuan()
  const toast = useToast()
  const [leaveHistoryOpen, setLeaveHistoryOpen] = useState(false)
  const [photoModal, setPhotoModal] = useState(null) // null | { dataUrl, sizeKB }
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  // ------------------------------------------------------------
  // Self-service contact fields (non-sensitif, bisa diedit sendiri)
  // ------------------------------------------------------------
  const [phone, setPhone] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [contactError, setContactError] = useState({})
  const [contactConfirm, setContactConfirm] = useState(false)
  const contactsSaved = !!currentUser?.phone

  // Sync form dengan currentUser saat user berganti (login/logout).
  useEffect(() => {
    setPhone(currentUser?.phone || '')
    setPersonalEmail(currentUser?.personalEmail || '')
    setEmergencyName(currentUser?.emergencyContact?.name || '')
    setEmergencyPhone(currentUser?.emergencyContact?.phone || '')
    setContactError({})
  }, [currentUser?.id])

  const currentYear = new Date().getFullYear()
  const balance = currentUser
    ? getLeaveBalance(currentUser.id, currentYear)
    : { remaining: 0, totalQuota: 0, used: 0 }

  const leaveHistory = useMemo(() => {
    if (!currentUser) return []
    const currentYear = new Date().getFullYear()
    const pengajuanItems = pengajuan
      .filter((p) => p.userId === currentUser.id && p.type === 'cuti')
      .map((p) => ({
        kind: 'pengajuan',
        id: p.id,
        date: p.createdAt,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        reason: p.reason,
        type: p.type,
        reviewedAt: p.reviewedAt,
        reviewedByName: p.reviewedByName,
      }))
    const adjustmentItems = getLeaveAdjustments(currentUser.id, currentYear)
      .map((a) => ({
        kind: 'adjustment',
        id: a.id,
        date: a.createdAt,
        startDate: a.startDate,
        endDate: a.endDate,
        days: a.days,
        reason: a.reason,
        adjustedBy: a.adjustedBy,
        year: a.year,
      }))
    return [...pengajuanItems, ...adjustmentItems]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [pengajuan, currentUser, getLeaveAdjustments])

  if (!currentUser) {
    return (
      <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
        <PageHeader title="Pengaturan" />
        <div className="card flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
          <p className="text-sm text-slate-500">Data pengguna tidak tersedia.</p>
          <Link
            to="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Masuk
          </Link>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // ------------------------------------------------------------
  // Photo upload handlers
  // ------------------------------------------------------------
  const openPhotoPicker = () => fileInputRef.current?.click()

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0]
    // Reset value supaya pilih file yang sama bisa trigger ulang
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setPhotoError('')
    if (!file.type.startsWith('image/')) {
      setPhotoError('File harus berupa gambar (JPG, PNG, atau WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Ukuran file maksimal 10 MB.')
      return
    }
    // Resize via canvas → maks 512x512, JPEG quality 0.85.
    // Ini menjaga localStorage tetap ramping (target ~30-100KB per foto)
    // sambil mempertahankan detail yang cukup untuk foto profil presisi.
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const TARGET = 512
        const ratio = Math.min(TARGET / img.width, TARGET / img.height, 1)
        const w = Math.max(1, Math.round(img.width * ratio))
        const h = Math.max(1, Math.round(img.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024)
        setPhotoModal({ dataUrl, sizeKB })
      }
      img.onerror = () => setPhotoError('Gagal membaca gambar. Coba file lain.')
      img.src = reader.result
    }
    reader.onerror = () => setPhotoError('Gagal membaca file.')
    reader.readAsDataURL(file)
  }

  const savePhoto = async () => {
    if (!photoModal) return
    const result = await updateUser(currentUser.id, { photo: photoModal.dataUrl })
    if (!result.ok) {
      setPhotoError(result.error || 'Gagal menyimpan foto.')
      return
    }
    setPhotoModal(null)
  }

  const removePhoto = async () => {
    const result = await updateUser(currentUser.id, { photo: null })
    if (!result.ok) {
      setPhotoError(result.error || 'Gagal menghapus foto.')
      return
    }
    setPhotoModal(null)
  }

  // Handler simpan kontak & informasi tambahan (field non-sensitif).
  const handleSaveContact = () => {
    const errs = {}
    const phoneCheck = validatePhone(phone)
    if (!phoneCheck.isValid) errs.phone = phoneCheck.error
    const emailCheck = validatePersonalEmail(personalEmail)
    if (!emailCheck.isValid) errs.personalEmail = emailCheck.error
    const ecNameCheck = validateEmergencyContactName(emergencyName)
    if (!ecNameCheck.isValid) errs.emergencyName = ecNameCheck.error
    const ecPhoneCheck = validatePhone(emergencyPhone)
    if (!ecPhoneCheck.isValid) errs.emergencyPhone = ecPhoneCheck.error

    // Cross-validation: jika salah satu field kontak darurat diisi, keduanya wajib diisi.
    const hasEcName = emergencyName.trim().length > 0
    const hasEcPhone = emergencyPhone.trim().length > 0
    if (hasEcName && !hasEcPhone) {
      errs.emergencyPhone = 'Nomor HP kontak darurat wajib diisi jika nama diisi.'
    } else if (hasEcPhone && !hasEcName) {
      errs.emergencyName = 'Nama kontak darurat wajib diisi jika nomor HP diisi.'
    }

    if (Object.keys(errs).length > 0) {
      setContactError(errs)
      return
    }

    setContactConfirm(true)
  }

  const executeSaveContact = async () => {
    setContactConfirm(false)
    const result = await updateUser(currentUser.id, {
      phone: phone.trim(),
      personalEmail: personalEmail.trim(),
      emergencyContact: {
        name: emergencyName.trim(),
        phone: emergencyPhone.trim(),
      },
    })
    if (!result.ok) {
      setContactError({ _form: result.error || 'Gagal menyimpan.' })
      return
    }
    setContactError({})
    toast.success('Kontak berhasil diperbarui.')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      <PageHeader title="Pengaturan" subtitle="Profil & preferensi akun" />

      <div className="sticky top-0 z-10 -mx-5 mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 bg-white/80 px-5 py-2 backdrop-blur-md scrollbar-hide">
        {[
          { id: 'profil', label: 'Profil' },
          { id: 'kontak', label: 'Kontak' },
          { id: 'cuti', label: 'Cuti' },
          { id: 'keamanan', label: 'Keamanan' },
          { id: 'notifikasi', label: 'Notifikasi' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Profile Header Card */}
      <div id="profil" className="card mb-5 overflow-hidden p-5 animate-slide-up">
        <div className="flex items-center gap-4">
          <Avatar
            name={currentUser.fullName || currentUser.username}
            color={currentUser.avatarColor}
            photo={currentUser.photo}
            size="xl"
            editable
            onClick={openPhotoPicker}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoFile}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-900">
              {currentUser.fullName || currentUser.username}
            </h2>
            <p className="text-xs text-slate-500">@{currentUser.username}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Aktif
            </p>
          </div>
        </div>
      </div>

      {/* Saldo Cuti Card */}
      <button
        id="cuti"
        onClick={() => setLeaveHistoryOpen(true)}
        className="card mb-5 w-full overflow-hidden p-5 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99] animate-slide-up"
        style={{ animationDelay: '0.03s' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Saldo Cuti Tahunan</p>
            <p className="font-mono text-[10px] text-slate-400">Tahun {currentYear}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-4xl font-extrabold text-slate-900">{balance.remaining}</span>
            <span className="ml-1 text-base font-bold text-slate-400">/ {balance.totalQuota}</span>
            <p className="font-mono text-[10px] text-slate-400">hari tersisa</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-rose-600">
              {balance.used > 0 ? `-${balance.used}` : balance.used}
            </p>
            <p className="font-mono text-[10px] text-slate-400">terpakai</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${balance.totalQuota > 0 ? Math.min(100, (balance.used / balance.totalQuota) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <span>Tap untuk lihat riwayat cuti</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </p>
      </button>

      {/* Personal Info */}
      <div className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Informasi Pribadi</h3>
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          label="Nama Lengkap"
          value={currentUser.fullName}
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h2a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          label="NIK (Nomor Induk Karyawan)"
          value={currentUser.nik}
          mono
          badge={
            !currentUser.nik ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                Menunggu Admin
              </span>
            ) : null
          }
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          label="Divisi"
          value={currentUser.division}
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
          label="Nomor KTP"
          value={maskKtp(currentUser.ktp)}
          mono
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          label="Tempat, Tanggal Lahir"
          value={
            currentUser.birthPlace || currentUser.birthDate
              ? `${currentUser.birthPlace || ''}${currentUser.birthPlace && currentUser.birthDate ? ', ' : ''}${formatTgl(currentUser.birthDate)}`.trim()
              : '-'
          }
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          label="Jenis Kelamin"
          value={sexLabel(currentUser.sex)}
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          label="Alamat"
          value={currentUser.address}
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          }
          label="Username"
          value={`@${currentUser.username}`}
        />
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          label="Bergabung Sejak"
          value={formatJoinDate(currentUser.createdAt)}
        />
      </div>

      {/* Kontak & Informasi Tambahan — editable, non-sensitif */}
      <div id="kontak" className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Kontak & Informasi Tambahan
          </h3>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
          Data ini <span className="font-semibold">hanya bisa diisi satu kali</span>{' '}
          dan tidak mempengaruhi data KTP yang terkunci.
        </p>

        <div className="space-y-3">
          {/* Nomor HP */}
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Nomor HP
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder="081234567890"
              disabled={contactsSaved}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tracking-wider transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
            {contactsSaved ? (
              <p className="mt-1 font-mono text-[10px] text-emerald-600">✓ Tersimpan</p>
            ) : (
              <p className="mt-1 font-mono text-[10px] text-slate-400">{phone.length}/13 digit · harus dimulai dari “08”</p>
            )}
            {contactError.phone && <p className="mt-1 text-[11px] font-medium text-red-600">{contactError.phone}</p>}
          </div>

          {/* Email Pribadi */}
          <div>
            <label htmlFor="personalEmail" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Email Pribadi
            </label>
            <input
              id="personalEmail"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="nama@email.com"
              disabled={contactsSaved}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
            {contactsSaved && <p className="mt-1 font-mono text-[10px] text-emerald-600">✓ Tersimpan</p>}
            {contactError.personalEmail && <p className="mt-1 text-[11px] font-medium text-red-600">{contactError.personalEmail}</p>}
          </div>

          {/* Kontak Darurat */}
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
              🚨 Kontak Darurat
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="emergencyName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Nama
                </label>
                <input
                  id="emergencyName"
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Nama keluarga / kerabat"
                  disabled={contactsSaved}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                {contactsSaved && <p className="mt-1 font-mono text-[10px] text-emerald-600">✓ Tersimpan</p>}
                {contactError.emergencyName && <p className="mt-1 text-[11px] font-medium text-red-600">{contactError.emergencyName}</p>}
              </div>
              <div>
                <label htmlFor="emergencyPhone" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Nomor HP
                </label>
                <input
                  id="emergencyPhone"
                  type="tel"
                  inputMode="numeric"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="081234567890"
                  disabled={contactsSaved}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tracking-wider transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                {contactsSaved ? (
                  <p className="mt-1 font-mono text-[10px] text-emerald-600">✓ Tersimpan</p>
                ) : (
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {emergencyPhone.length}/13 digit · harus dimulai dari “08”
                  </p>
                )}
                {contactError.emergencyPhone && <p className="mt-1 text-[11px] font-medium text-red-600">{contactError.emergencyPhone}</p>}
              </div>
            </div>
          </div>

          {/* Form-level error */}
          {contactError._form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {contactError._form}
            </div>
          )}

          {/* Save button / saved badge */}
          <div className="flex items-center gap-3 pt-1">
            {contactsSaved ? (
              <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-bold text-emerald-700">
                ✓ Kontak sudah disimpan
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveContact}
                className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
              >
              Simpan Perubahan
            </button>
            )}
        </div>
      </div>
    </div>

      <ConfirmModal
        open={contactConfirm}
        onClose={() => setContactConfirm(false)}
        onConfirm={executeSaveContact}
        title="Simpan Kontak?"
        message="Pastikan nomor HP, email pribadi, dan kontak darurat sudah benar sebelum disimpan."
        confirmLabel="Simpan"
        variant="default"
      />

      {/* App Info */}
      <div className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Tentang Aplikasi</h3>
        <InfoRow
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Versi Aplikasi"
          value="HRMS Mobile v1.0"
        />
      </div>

      {/* Change Password */}
      <ChangePasswordSection />

      <PushNotificationSection />

      <div className="card p-5 animate-slide-up" style={{ animationDelay: '0.14s' }}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Aplikasi</h3>
        <div className="space-y-2">
          <button onClick={() => window.location.reload()} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
            Perbarui Aplikasi
          </button>
          <button onClick={hardRefreshPWA} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
            Bersihkan Cache &amp; Muat Ulang (Hard Refresh PWA)
          </button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Pakai ini kalau PWA tidak update atau `Clock In` bilang lokasi ditolak padahal sudah Add to Home Screen.<br />
            <b>Android:</b> tahan ikon HRMS → Info Aplikasi → Penyimpanan → Hapus cache → Izin → Lokasi → Izinkan.<br />
            <b>iPhone:</b> hapus PWA → buka Safari → Share → Add to Home Screen lagi → izinkan lokasi saat Clock In.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Keluar dari Akun
        </button>
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          © {new Date().getFullYear()} Prasasti Connect · HRMS
        </p>
      </div>

      <LeaveHistoryModal
        open={leaveHistoryOpen}
        onClose={() => setLeaveHistoryOpen(false)}
        balance={balance}
        history={leaveHistory}
        currentYear={currentYear}
      />

      <PhotoUploadModal
        preview={photoModal}
        onClose={() => setPhotoModal(null)}
        onSave={savePhoto}
        onRemove={removePhoto}
        error={photoError}
        existingPhoto={Boolean(currentUser.photo)}
      />
    </div>
  )
}

function formatDateRange(start, end) {
  if (!start || !end) return '-'
  if (start === end) {
    return new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const s = new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const e = new Date(end + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

function formatAdjustDateRange(startIso, endIso) {
  if (!startIso || !endIso) return '—'
  const fmtFull = (s) => {
    const d = new Date(s + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const fmtShort = (s) => {
    const d = new Date(s + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }
  if (startIso === endIso) return fmtFull(startIso)
  const startY = startIso.slice(0, 4)
  const endY = endIso.slice(0, 4)
  if (startY === endY) return `${fmtShort(startIso)} – ${fmtFull(endIso)}`
  return `${fmtFull(startIso)} – ${fmtFull(endIso)}`
}

function LeaveHistoryModal({ open, onClose, balance, history, currentYear }) {
  if (!open) return null
  return (
    <Modal open onClose={onClose} title="Riwayat Cuti">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Saldo {currentYear}</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <span className="text-3xl font-extrabold text-slate-900">{balance.remaining}</span>
              <span className="ml-1 text-base font-bold text-slate-400">/ {balance.totalQuota} hari</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-rose-600">
                {balance.used > 0 ? `-${balance.used}` : balance.used} hari terpakai
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${balance.totalQuota > 0 ? Math.min(100, (balance.used / balance.totalQuota) * 100) : 0}%` }}
            />
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">Riwayat Pengajuan Cuti</h4>
          {history.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-6 text-center text-sm text-slate-500">
              Belum ada pengajuan cuti.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {history.map((item) => {
                if (item.kind === 'adjustment') {
                  // Penyesuaian saldo cuti (cuti bersama) — menambah `used` dengan rentang tanggal
                  const dateRange = formatAdjustDateRange(item.startDate, item.endDate)
                  const adjDate = item.date ? new Date(item.date) : null
                  return (
                    <div key={item.id} className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-bold text-slate-700">{dateRange}</p>
                          <p className="mt-0.5 text-xs font-bold text-rose-600">+{item.days} hari terpakai</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Cuti Bersama
                        </span>
                      </div>
                      {item.reason && <p className="mt-2 text-xs leading-relaxed text-slate-500">"{item.reason}"</p>}
                      <p className="mt-2 border-t border-amber-200/40 pt-2 font-mono text-[10px] text-slate-400">
                            Oleh {item.adjustedBy || 'admin'}
                            {adjDate ? ` · ${adjDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                          </p>
                    </div>
                  )
                }
                // Pengajuan cuti biasa
                const days = calculateLeaveDays(item.startDate, item.endDate)
                return (
                  <div key={item.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] font-bold text-slate-700">{formatDateRange(item.startDate, item.endDate)}</p>
                        <p className="mt-0.5 text-xs font-bold text-rose-600">-{days} hari</p>
                      </div>
                      <span className={`chip border ${item.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === 'rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'approved' ? 'bg-emerald-500' : item.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        {item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                      </span>
                    </div>
                    {item.reason && <p className="mt-2 text-xs leading-relaxed text-slate-500">"{item.reason}"</p>}
                    {item.reviewedAt && (
                      <p className="mt-2 border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-400">
                        {item.status === 'approved' ? 'Disetujui' : 'Ditolak'} · {new Date(item.reviewedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}{item.reviewedByName ? ` oleh ${item.reviewedByName}` : ''}
                      </p>
                    )}
                  </div>
                )
              })}
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

function PhotoUploadModal({ preview, onClose, onSave, onRemove, error, existingPhoto }) {
  if (!preview) return null
  return (
    <Modal
      open
      title="Ubah Foto Profil"
      onClose={onClose}
      footer={
        <div className="flex w-full gap-3">
          {existingPhoto && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
            >
              Hapus Foto
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Simpan Foto
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Preview lingkaran besar — crop presisi dengan object-cover */}
        <div className="flex justify-center">
          <div className="relative h-44 w-44 overflow-hidden rounded-full ring-4 ring-indigo-100 shadow-lg">
            <img
              src={preview.dataUrl}
              alt="Pratinjau foto profil"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Info ukuran & dimensi setelah resize */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold uppercase tracking-wider text-slate-500">Ukuran setelah optimasi</span>
            <span className="font-mono font-bold text-slate-700">{preview.sizeKB} KB</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Foto di-resize otomatis ke 512×512 px dan disimpan sebagai JPEG untuk menjaga
            performa aplikasi.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ============================================================
// Browser Notification Section — minta izin + toggle preferensi user
// ============================================================
// Wrapper tipis di sekitar browserNotifications utility agar user bisa:
//   1. Melihat status izin saat ini (granted/default/denied/unsupported)
//   2. Minta izin lewat dialog browser
//   3. Toggle preferensi (disimpan di localStorage via PREF_STORAGE_KEY)
//
// Preferensi dibaca oleh NotificationsContext untuk memutuskan apakah
// browser notification boleh ditampilkan saat tab di background.

const BROWSER_PERM_STATUS = {
  granted: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓', label: 'Diizinkan' },
  default: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠', label: 'Belum Diizinkan' },
  denied: { bg: 'bg-rose-50', text: 'text-rose-700', icon: '✗', label: 'Ditolak' },
  unsupported: { bg: 'bg-slate-100', text: 'text-slate-600', icon: '—', label: 'Tidak Didukung' },
}

function BrowserNotificationSection() {
  const [perm, setPerm] = useState(() => getBrowserPermissionStatus())
  const [enabled, setEnabled] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    const pref = localStorage.getItem(PREF_STORAGE_KEY)
    return pref === null ? true : pref === 'true'
  })
  const [requesting, setRequesting] = useState(false)

  const handleRequest = async () => {
    setRequesting(true)
    try {
      const result = await requestBrowserPermission()
      setPerm(result)
    } finally {
      setRequesting(false)
    }
  }

  const handleToggle = (newVal) => {
    setEnabled(newVal)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREF_STORAGE_KEY, String(newVal))
    }
  }

  const status = BROWSER_PERM_STATUS[perm] || BROWSER_PERM_STATUS.unsupported

  return (
    <div id="notifikasi" className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.12s' }}>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
        Notifikasi Browser
      </h3>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Notifikasi Desktop</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Terima notifikasi OS-level saat tab HRMS tidak aktif di foreground (mis. saat browse tab lain).
            </p>

            {/* Status izin */}
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.text}`}>
                <span aria-hidden="true">{status.icon}</span>
                Status: {status.label}
              </span>
            </div>

            {/* Toggle preferensi */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Aktifkan notifikasi browser</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => handleToggle(!enabled)}
                disabled={perm === 'unsupported'}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  enabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Tombol minta izin */}
            {perm === 'default' && (
              <button
                type="button"
                onClick={handleRequest}
                disabled={requesting}
                className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
              >
                {requesting ? 'Meminta izin...' : 'Minta Izin Notifikasi'}
              </button>
            )}

            {/* Pesan untuk status tertentu */}
            {perm === 'denied' && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-700">
                Izin notifikasi ditolak oleh browser. Buka pengaturan situs (ikon gembok di address bar)
                untuk mengizinkan notifikasi HRMS.
              </p>
            )}
            {perm === 'unsupported' && (
              <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                Browser Anda tidak mendukung Notification API. Coba perbarui browser atau gunakan browser modern.
              </p>
            )}
            {perm === 'granted' && enabled && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-700">
                Notifikasi browser aktif. Anda akan menerima pemberitahuan OS-level untuk pengajuan
                yang disetujui/ditolak, event baru, dan pengumuman penting.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Push Notification Section — Web Push (true push, jalan walau
// aplikasi ditutup / tab tidak dibuka).
// ============================================================
function PushNotificationSection() {
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState(() => (pushSupported() ? Notification.permission : 'unsupported'))

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const sub = await getPushSubscription()
        if (mounted) setEnabled(Boolean(sub))
      } catch {
        // SW belum siap — biarkan dalam keadaan mati
      } finally {
        if (mounted) setChecking(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleToggle = async (next) => {
    setBusy(true)
    try {
      if (next) {
        const result = await enablePush()
        setPerm(result.status)
        if (result.status === 'granted') {
          setEnabled(true)
          toast.success('Notifikasi push aktif')
        } else if (result.status === 'denied') {
          toast.error('Izin notifikasi ditolak oleh browser')
        } else {
          toast.error('Gagal mengaktifkan notifikasi push')
        }
      } else {
        await disablePush()
        setEnabled(false)
        toast.success('Notifikasi push dimatikan')
      }
    } catch (err) {
      toast.error(err?.message || 'Gagal mengubah notifikasi push')
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    try {
      await testPush('Prasasti Connect', 'Notifikasi push berfungsi dengan baik!')
      toast.success('Notifikasi uji terkirim ke perangkat ini')
    } catch (err) {
      toast.error(err?.message || 'Gagal mengirim notifikasi uji')
    } finally {
      setBusy(false)
    }
  }

  const permBadge = {
    granted: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Diizinkan' },
    default: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Belum Diizinkan' },
    denied: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Ditolak' },
    unsupported: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Tidak Didukung' },
  }[perm] || { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Tidak Didukung' }

  return (
    <div id="notifikasi" className="card mb-5 p-5 animate-slide-up" style={{ animationDelay: '0.14s' }}>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Notifikasi Push (OneSignal)</h3>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Notifikasi Push (PWA)</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Terima notifikasi walau aplikasi ditutup — mis. pengajuan disetujui/ditolak atau
              absensi manual dikonfirmasi. Butuh aplikasi terpasang (Add to Home Screen) di iPhone.
            </p>

            <div className="mt-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${permBadge.bg} ${permBadge.text}`}>
                Izin: {permBadge.label}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Aktifkan notifikasi push</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => handleToggle(!enabled)}
                disabled={checking || busy || !pushSupported()}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  enabled ? 'bg-violet-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {!pushSupported() && (
              <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                Browser/perangkat tidak mendukung Web Push. Gunakan Chrome, Edge, atau Firefox di
                Android/desktop; iPhone butuh Safari dengan aplikasi terpasang.
              </p>
            )}
            {perm === 'denied' && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-700">
                Izin notifikasi ditolak oleh browser. Buka pengaturan situs (ikon gembok di address
                bar) untuk mengizinkan kembali.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

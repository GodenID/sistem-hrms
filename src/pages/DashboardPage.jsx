import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClock } from '../context/ClockContext'
import { useEvents } from '../context/EventsContext'
import { useNotifications } from '../context/NotificationsContext'
import { useAnnouncements } from '../context/AnnouncementsContext'
import { usePengajuan } from '../context/PengajuanContext'
import { useLocations } from '../context/LocationContext'
import { getCurrentPosition, findNearestLocation } from '../utils/location'
import LocationMapView from '../components/LocationMapView'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import Avatar from '../components/Avatar'

function formatLiveTime() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // Manual format to ensure ':' separator (id-ID locale may render as '.')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss}`
  return { dateStr, timeStr }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

const menuItems = [
  {
    to: '/absensi',
    label: 'Absensi',
    desc: 'Riwayat absensi',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    to: '/events',
    label: 'Event',
    desc: 'Membuat event dan voucher event',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    iconBg: 'bg-indigo-50 text-indigo-600',
  },
  {
    to: '/pengajuan',
    label: 'Pengajuan',
    desc: 'Cuti tahunan, sakit, lembur dan lup absen',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: 'bg-amber-50 text-amber-600',
  },
  {
    to: '/calendar',
    label: 'Kalender',
    desc: 'Event dan Libur dan Cuti',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    iconBg: 'bg-fuchsia-50 text-fuchsia-600',
  },
  {
    to: '/okr',
    label: 'OKR',
    desc: 'Input, target, statistik & tim',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    iconBg: 'bg-violet-50 text-violet-600',
  },
]

export default function DashboardPage() {
  const { user, currentUser, logout, isAdmin } = useAuth()
  const { clockIn, clockOut, doClockIn, doClockOut, hasClockedIn, hasClockedOut, submitPendingClock, pendingClocks, approvePendingClock, rejectPendingClock } = useClock()
  const { notifications, unreadCount, markAllRead, clearAll, dismiss } = useNotifications()
  const { updateStatus } = usePengajuan()
  const { updateEvent } = useEvents()
  const { announcements, typeMeta } = useAnnouncements()
  const { locations } = useLocations()
  const [live, setLive] = useState(() => formatLiveTime())
  const [notifOpen, setNotifOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [locationStatus, setLocationStatus] = useState(null)
  const [clockLoading, setClockLoading] = useState(false)
  const [pendingReason, setPendingReason] = useState('')
  const [pendingType, setPendingType] = useState(null) // 'clockIn' | 'clockOut' | null
  const [activeAnnouncementIdx, setActiveAnnouncementIdx] = useState(0)
  const announcementCarouselRef = useRef(null)
  const navigate = useNavigate()

  const handleApprovePengajuan = (n) => {
    if (n.refType === 'pengajuan' && n.refId && currentUser) {
      updateStatus(n.refId, 'approved', currentUser)
    }
    if (n.refType === 'pending_clock' && n.refId && currentUser) {
      approvePendingClock(n.refId)
    }
    dismiss(n.id)
    onCloseNotif()
  }

  const handleRejectPengajuan = (n) => {
    if (n.refType === 'pengajuan' && n.refId && currentUser) {
      updateStatus(n.refId, 'rejected', currentUser)
    }
    if (n.refType === 'pending_clock' && n.refId && currentUser) {
      rejectPendingClock(n.refId)
    }
    dismiss(n.id)
    onCloseNotif()
  }

  const handleApproveEvent = (n) => {
    if (n.refType === 'event' && n.refId && currentUser) {
      updateEvent(n.refId, { status: 'approved', reviewedBy: currentUser.id, reviewedByName: currentUser.fullName })
    }
    dismiss(n.id)
    onCloseNotif()
  }

  const handleRejectEvent = (n) => {
    if (n.refType === 'event' && n.refId && currentUser) {
      updateEvent(n.refId, { status: 'rejected', reviewedBy: currentUser.id, reviewedByName: currentUser.fullName })
    }
    dismiss(n.id)
    onCloseNotif()
  }

  const scrollAnnouncementCarousel = (dir) => {
    const el = announcementCarouselRef.current
    if (!el) return
    const card = el.querySelector('[data-carousel-card]')
    const cardWidth = card ? card.offsetWidth + 8 : 240
    el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' })
  }

  const handleAnnouncementScroll = () => {
    const el = announcementCarouselRef.current
    if (!el) return
    const card = el.querySelector('[data-carousel-card]')
    if (!card) return
    const cardWidth = card.offsetWidth + 8
    const idx = Math.round(el.scrollLeft / cardWidth)
    setActiveAnnouncementIdx(Math.min(Math.max(idx, 0), announcements.length - 1))
  }

  useEffect(() => {
    const id = setInterval(() => {
      setLive(formatLiveTime())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const greeting = getGreeting()
  const workDuration = (() => {
    if (!clockIn || !clockOut) return null
    const [h1, m1, s1] = clockIn.replace(' WIB', '').split(':').map(Number)
    const [h2, m2, s2] = clockOut.replace(' WIB', '').split(':').map(Number)
    const total = (h2 * 3600 + m2 * 60 + s2) - (h1 * 3600 + m1 * 60 + s1)
    if (total <= 0) return null
    const hh = Math.floor(total / 3600)
    const mm = Math.floor((total % 3600) / 60)
    return `${hh} jam ${mm} menit`
  })()

  const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const hasPendingClockIn = currentUser && pendingClocks.some((p) => p.userId === currentUser.id && p.date === todayKey && p.type === 'clockIn' && p.status === 'pending')
  const hasPendingClockOut = currentUser && pendingClocks.some((p) => p.userId === currentUser.id && p.date === todayKey && p.type === 'clockOut' && p.status === 'pending')

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const onCloseNotif = () => setNotifOpen(false)

  const checkAndSetLocation = async () => {
    const pos = await getCurrentPosition()
    const nearest = findNearestLocation(pos.lat, pos.lng, locations)
    const status = {
      ok: nearest && nearest.distance <= nearest.radius,
      name: nearest?.name,
      distance: nearest?.distance,
      radius: nearest?.radius,
      userLat: pos.lat,
      userLng: pos.lng,
      locLat: nearest?.lat,
      locLng: nearest?.lng,
    }
    setLocationStatus(status)
    return status
  }

  const handleClockIn = async () => {
    setClockLoading(true)
    if (locations.length > 0) {
      try {
        const status = await checkAndSetLocation()
        if (!status.ok) {
          setPendingType('clockIn')
          setPendingReason('')
          setLocationStatus(status)
          setClockLoading(false)
          return
        }
      } catch {
        setLocationStatus({ ok: false, name: null, distance: null })
        setClockLoading(false)
        return
      }
    }
    doClockIn()
    setClockLoading(false)
  }

  const handleClockOut = async () => {
    setClockLoading(true)
    if (locations.length > 0) {
      try {
        const status = await checkAndSetLocation()
        if (!status.ok) {
          setPendingType('clockOut')
          setPendingReason('')
          setLocationStatus(status)
          setClockLoading(false)
          return
        }
      } catch {
        setLocationStatus({ ok: false, name: null, distance: null })
        setClockLoading(false)
        return
      }
    }
    doClockOut()
    setClockLoading(false)
  }

  const handleSubmitPending = () => {
    if (!pendingType) return
    submitPendingClock({ type: pendingType, reason: pendingReason })
    setPendingType(null)
    setPendingReason('')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col bg-slate-50 px-5 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between animate-fade-in">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            name={currentUser?.fullName || user}
            color={currentUser?.avatarColor}
            photo={currentUser?.photo}
            size="md"
            className="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{greeting},</p>
            <p className="truncate text-base font-bold leading-tight text-slate-900">
              {currentUser?.fullName || user || 'Pengguna'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotifOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            aria-label="Notifikasi"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 px-1 font-mono text-[10px] font-bold text-white shadow-[0_4px_10px_-2px_rgba(244,63,94,0.6)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <Link
            to="/settings"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            aria-label="Profil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Live Clock Card */}
      <div className="card mb-6 overflow-hidden p-7 animate-slide-up">
        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
          </span>
          Live Time
        </div>
        <p className="text-center font-mono text-5xl font-extrabold tracking-tight text-slate-900">
          {live.timeStr}
        </p>
        <p className="mt-2 text-center text-sm font-semibold text-slate-500">
          {live.dateStr}
        </p>
      </div>

      {/* Location Status */}
      {locationStatus?.ok ? (
        <div className="mb-3 animate-slide-up" style={{ animationDelay: '0.03s' }}>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>di <strong>{locationStatus.name}</strong> ({locationStatus.distance}m)</span>
            </div>
            <button onClick={() => setLocationStatus(null)} className="flex-shrink-0 rounded-lg p-1 transition hover:bg-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : locationStatus && !locationStatus.ok && !pendingType && !locationStatus.name ? (
        <div className="mb-3 animate-slide-up" style={{ animationDelay: '0.03s' }}>
          <div className="flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
            <div className="flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Tidak bisa mendapatkan lokasi. Izinkan akses lokasi di browser.</span>
            </div>
            <button onClick={() => setLocationStatus(null)} className="flex-shrink-0 rounded-lg p-1 transition hover:bg-rose-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* Action Buttons Side-by-Side */}
      <div className="mb-6 grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <button
          onClick={handleClockIn}
          disabled={hasClockedIn || hasPendingClockIn || clockLoading}
          className={`group rounded-2xl p-5 text-left transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 active:scale-[0.98] ${
            hasClockedIn || hasPendingClockIn || clockLoading
              ? 'cursor-not-allowed border border-slate-200 bg-white text-slate-400'
              : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700'
          }`}
        >
          <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${hasClockedIn || hasPendingClockIn || clockLoading ? 'bg-slate-100' : 'bg-white/20'}`}>
            {clockLoading && !hasClockedIn ? (
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">
            {clockLoading ? 'Memeriksa...' : hasPendingClockIn ? 'Menunggu' : 'Masuk'}
          </p>
          <p className="text-lg font-extrabold">
            {clockLoading ? 'Lokasi' : hasPendingClockIn ? 'Sudah Diajukan' : 'Clock In'}
          </p>
        </button>

        <button
          onClick={handleClockOut}
          disabled={!hasClockedIn || hasClockedOut || hasPendingClockOut || clockLoading}
          className={`group rounded-2xl p-5 text-left transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/20 active:scale-[0.98] ${
            !hasClockedIn || hasClockedOut || hasPendingClockOut || clockLoading
              ? 'cursor-not-allowed border border-slate-200 bg-white text-slate-400'
              : 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600'
          }`}
        >
          <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${!hasClockedIn || hasClockedOut || hasPendingClockOut || clockLoading ? 'bg-slate-100' : 'bg-white/20'}`}>
            {clockLoading && hasClockedIn && !hasClockedOut ? (
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">
            {clockLoading ? 'Memeriksa...' : hasPendingClockOut ? 'Menunggu' : 'Pulang'}
          </p>
          <p className="text-lg font-extrabold">
            {clockLoading ? 'Lokasi' : hasPendingClockOut ? 'Sudah Diajukan' : 'Clock Out'}
          </p>
        </button>
      </div>

      {/* Timestamp Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Clock In</p>
          </div>
          <p className="font-mono text-xl font-extrabold text-slate-900">
            {clockIn ? clockIn.replace(' WIB', '') : '--:--:--'}
          </p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">WIB</p>
        </div>

        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Clock Out</p>
          </div>
          <p className="font-mono text-xl font-extrabold text-slate-900">
            {clockOut ? clockOut.replace(' WIB', '') : '--:--:--'}
          </p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">
            {workDuration ? `Durasi: ${workDuration}` : 'WIB'}
          </p>
        </div>
      </div>

      {/* Pengumuman */}
      {announcements.length > 0 && (
        <div className="mb-4 animate-slide-up" style={{ animationDelay: '0.13s' }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">📢 Pengumuman</h2>
            {announcements.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollAnnouncementCarousel(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
                  aria-label="Sebelumnya"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => scrollAnnouncementCarousel(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
                  aria-label="Selanjutnya"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div
            ref={announcementCarouselRef}
            onScroll={handleAnnouncementScroll}
            className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto scrollbar-hide px-5 pb-2"
          >
            {announcements.map((a) => {
              const meta = typeMeta(a.type)
              return (
                <button
                  key={a.id}
                  data-carousel-card
                  onClick={() => setSelectedAnnouncement(a)}
                  className="card w-[78%] flex-shrink-0 snap-start p-3 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
                      {meta.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{a.body}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-400">
                        {timeAgo(a.createdAt)} · {a.createdByName}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {announcements.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {announcements.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === activeAnnouncementIdx ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu Section */}
      <div className="mb-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Menu</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card group flex flex-col items-center justify-center gap-2 p-4 text-center transition hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.iconBg}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                <p className="text-[10px] font-medium text-slate-500">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Other Section */}
      <div className="mb-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Lainnya</h2>
        </div>
        <div className="space-y-2">
          <Link
            to="/directory"
            className="card group flex items-center gap-3 p-3.5 transition hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">Direktori Karyawan</p>
              <p className="text-[10px] font-medium text-slate-500">Lihat semua karyawan terdaftar</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-slate-400 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="card group flex items-center gap-3 p-3.5 transition hover:border-violet-300 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">Admin Panel</p>
                <p className="text-[10px] font-medium text-slate-500">Kelola karyawan, pengajuan, absensi, event</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-violet-700">
                Admin
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Prasasti Group · HRMS Mobile v1.0
      </div>

      <NotificationsDrawer
        open={notifOpen}
        onClose={onCloseNotif}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
        onDismiss={dismiss}
        onApprove={handleApprovePengajuan}
        onReject={handleRejectPengajuan}
        onApproveEvent={handleApproveEvent}
        onRejectEvent={handleRejectEvent}
      />

      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          typeMeta={typeMeta}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

      <Modal
        open={Boolean(pendingType)}
        onClose={() => setPendingType(null)}
        title={pendingType === 'clockIn' ? 'Clock In di Luar Radius' : 'Clock Out di Luar Radius'}
      >
        <div className="space-y-4">
          {locationStatus?.name && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Kamu berada {locationStatus.distance}m dari &ldquo;{locationStatus.name}&rdquo; — di luar radius.
            </div>
          )}
          {locationStatus?.userLat && locationStatus?.locLat && (
            <LocationMapView
              userLat={locationStatus.userLat}
              userLng={locationStatus.userLng}
              locLat={locationStatus.locLat}
              locLng={locationStatus.locLng}
              radius={locationStatus.radius || 100}
            />
          )}
          <label className="block text-sm font-bold text-slate-700">Alasan</label>
          <textarea
            value={pendingReason}
            onChange={(e) => setPendingReason(e.target.value)}
            placeholder="Tulis alasan kamu clock in/pulang dari luar lokasi..."
            rows={3}
            className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            onClick={handleSubmitPending}
            disabled={!pendingReason.trim()}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajukan {pendingType === 'clockIn' ? 'Clock In' : 'Clock Out'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function AnnouncementDetailModal({ announcement, typeMeta, onClose }) {
  const meta = typeMeta(announcement.type)
  const TYPE_BADGE_STYLES = {
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    important: 'border-amber-200 bg-amber-50 text-amber-700',
    urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  return (
    <Modal open onClose={onClose} title="Pengumuman">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-2xl">
            {meta.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`chip border ${TYPE_BADGE_STYLES[announcement.type] || TYPE_BADGE_STYLES.info}`}>{meta.label}</span>
            <h3 className="mt-2 text-base font-bold text-slate-900">{announcement.title}</h3>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{announcement.body}</p>
        <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Dipublikasikan oleh</span>
            <span className="text-xs font-semibold text-slate-900">{announcement.createdByName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Waktu</span>
            <span className="text-xs font-semibold text-slate-900">
              {new Date(announcement.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(announcement.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
          Tutup
        </button>
      </div>
    </Modal>
  )
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const now = Date.now()
  const t = new Date(isoStr).getTime()
  const diff = Math.max(0, Math.floor((now - t) / 1000))
  if (diff < 60) return 'baru saja'
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function NotifIcon({ type }) {
  if (type === 'pengajuan_new') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    )
  }
  if (type === 'event_published') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }
  if (type === 'pengajuan_approved') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }
  if (type === 'pengajuan_rejected') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  }
  if (type === 'event_pending') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }
  if (type === 'event_approved') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }
  if (type === 'event_rejected') {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

function NotificationsDrawer({ open, onClose, notifications, onMarkAllRead, onClearAll, onDismiss, onApprove, onReject, onApproveEvent, onRejectEvent }) {
  const navigate = useNavigate()
  const [clearConfirm, setClearConfirm] = useState(false)

  if (!open) return null

  const handleTap = (n) => {
    // Click → otomatis hapus notifikasi dari list
    onDismiss(n.id)
    // Navigasi: prioritas ke `link` field (untuk notifikasi custom),
    // fallback ke event detail biar user bisa lihat detail event.
    if (n.link) {
      navigate(n.link)
    } else if (n.refType === 'event' && n.refId) {
      navigate(`/events/${n.refId}`)
    }
    onClose()
  }

  const handleAction = (e, fn, n) => {
    e.stopPropagation()
    fn(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-start sm:pt-16" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-mobile flex-col overflow-hidden rounded-t-3xl p-0 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              <span className="italic">Noti</span><span className="text-indigo-600">fikasi</span>
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{notifications.length} total</p>
          </div>
          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read) && (
              <button onClick={onMarkAllRead} className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 transition hover:bg-indigo-50">
                Tandai dibaca
              </button>
            )}
            <button onClick={() => setClearConfirm(true)} className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 transition hover:bg-rose-50" title="Hapus semua notifikasi">
              Hapus semua
            </button>
            <ConfirmModal
              open={clearConfirm}
              onClose={() => setClearConfirm(false)}
              onConfirm={() => { onClearAll(); setClearConfirm(false) }}
              title="Hapus Semua Notifikasi?"
              message="Semua notifikasi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
              confirmLabel="Hapus Semua"
              variant="danger"
            />
            <button onClick={onClose} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="Tutup">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900">Tidak ada notifikasi</h3>
              <p className="mt-1 text-xs text-slate-500">Notifikasi event, pengajuan, dan status akan muncul di sini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${!n.read ? 'bg-indigo-50/30' : ''}`}
                >
                  <NotifIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
                      {!n.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-600" />}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap line-clamp-3 text-xs text-slate-600">{n.body}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">{timeAgo(n.createdAt)}</p>
                    {n.type === 'pengajuan_new' && !n.read && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => handleAction(e, onReject, n)}
                          className="flex-1 rounded-lg border border-rose-200 bg-white py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 active:scale-95"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={(e) => handleAction(e, onApprove, n)}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                        >
                          Setujui
                        </button>
                      </div>
                    )}
                    {n.type === 'pending_clock_new' && !n.read && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => handleAction(e, onReject, n)}
                          className="flex-1 rounded-lg border border-rose-200 bg-white py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 active:scale-95"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={(e) => handleAction(e, onApprove, n)}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                        >
                          Setujui
                        </button>
                      </div>
                    )}
                    {n.type === 'event_pending' && !n.read && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => handleAction(e, onRejectEvent, n)}
                          className="flex-1 rounded-lg border border-rose-200 bg-white py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 active:scale-95"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={(e) => handleAction(e, onApproveEvent, n)}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                        >
                          Setujui
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

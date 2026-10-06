import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import { dateToKey, getCurrentPeriod } from '../utils/period'
import { useAuth } from './AuthContext'

function getTodayKey() {
  return dateToKey(new Date())
}

function formatTimeIndonesia(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const ClockContext = createContext(null)

export function ClockProvider({ children }) {
  const [history, setHistory] = useState([])
  const [pendingClocks, setPendingClocks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { currentUser } = useAuth()
  const today = getTodayKey()

  useEffect(() => {
    if (!currentUser) {
      setHistory([])
      setPendingClocks([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    let cancelled = false
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin'
    Promise.all([
      // Admin: ambil riwayat SEMUA karyawan (untuk tab Absensi admin & modal
      // detail karyawan). Karyawan biasa: hanya riwayat sendiri.
      api(isAdmin ? '/clock/history' : `/clock/history?userId=${currentUser.id}`).catch(() => ({ history: [] })),
      api('/clock/pending').catch(() => ({ pending: [] })),
    ])
      .then(([h, p]) => {
        if (cancelled) return
        setHistory(h.history || [])
        setPendingClocks(p.pending || [])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser])

  const todayRecord = useMemo(() => {
    const list = history || []
    return list.find((h) => h.date === today && h.userId === (currentUser?.id || 'unknown')) || { date: today, clockIn: null, clockOut: null }
  }, [history, today, currentUser])

  const doClockIn = useCallback(async ({ lat, lng } = {}) => {
    if (!currentUser) return { ok: false, error: 'Belum login' }
    try {
      const { record, location } = await api('/clock/in', {
        method: 'POST',
        body: { userId: currentUser.id, ...(lat != null ? { lat, lng } : {}) },
      })
      setHistory((prev) => {
        const list = prev || []
        const filtered = list.filter((h) => !(h.date === record.date && h.userId === currentUser.id))
        return [...filtered, record]
      })
      return { ok: true, record, location }
    } catch (err) {
      console.error('Clock in gagal:', err.message)
      return { ok: false, error: err.message, code: err.code }
    }
  }, [currentUser])

  const doClockOut = useCallback(async ({ lat, lng } = {}) => {
    if (!currentUser) return { ok: false, error: 'Belum login' }
    try {
      const { record, location } = await api('/clock/out', {
        method: 'POST',
        body: { userId: currentUser.id, ...(lat != null ? { lat, lng } : {}) },
      })
      setHistory((prev) => {
        const list = prev || []
        const filtered = list.filter((h) => !(h.date === record.date && h.userId === currentUser.id))
        return [...filtered, record]
      })
      return { ok: true, record, location }
    } catch (err) {
      console.error('Clock out gagal:', err.message)
      return { ok: false, error: err.message, code: err.code }
    }
  }, [currentUser])

  const getHistoryByDateRange = useCallback(
    (startKey, endKey) => {
      return (history || []).filter((h) => h.date >= startKey && h.date <= endKey)
    },
    [history],
  )

  const submitPendingClock = useCallback(async ({ type, reason }) => {
    if (!currentUser) return null
    const now = new Date()
    const time = formatTimeIndonesia(now)
    try {
      const { pending } = await api('/clock/pending', {
        method: 'POST',
        body: { type, reason: reason || '', date: dateToKey(now), time },
      })
      setPendingClocks((prev) => [pending, ...(prev || [])])
      return pending
    } catch (err) {
      console.error('Submit pending clock gagal:', err.message)
      return null
    }
  }, [currentUser])

  const approvePendingClock = useCallback(async (id) => {
    try {
      await api(`/clock/pending/${id}/approve`, { method: 'POST' })
      setPendingClocks((prev) =>
        (prev || []).map((p) => (p.id === id ? { ...p, status: 'approved', reviewedAt: new Date().toISOString() } : p))
      )
      // refresh history untuk memuat record baru
      if (currentUser) {
        api(`/clock/history?userId=${currentUser.id}`).then((h) => setHistory(h.history || [])).catch(() => {})
      }
    } catch (err) {
      console.error('Approve pending clock gagal:', err.message)
    }
  }, [currentUser])

  const rejectPendingClock = useCallback(async (id) => {
    try {
      await api(`/clock/pending/${id}/reject`, { method: 'POST' })
      setPendingClocks((prev) => (prev || []).filter((p) => p.id !== id))
    } catch (err) {
      console.error('Reject pending clock gagal:', err.message)
    }
  }, [])

  const setClockRecord = useCallback(async (userId, date, clockIn, clockOut) => {
    try {
      const { record } = await api('/clock/record', {
        method: 'PUT',
        body: { userId, date, clockIn: clockIn || null, clockOut: clockOut || null },
      })
      setHistory((prev) => {
        const list = prev || []
        const filtered = list.filter((h) => !(h.date === date && h.userId === userId))
        return [...filtered, record]
      })
    } catch (err) {
      console.error('Set clock record gagal:', err.message)
    }
  }, [])

  const getAvailablePeriods = useCallback((count = 6) => {
    const periods = []
    const todayDate = new Date()
    const current = getCurrentPeriod(todayDate)
    for (let i = 0; i < count; i += 1) {
      let m = current.month - i
      let y = current.year
      while (m < 0) {
        m += 12
        y -= 1
      }
      periods.push({ month: m, year: y })
    }
    return periods
  }, [])

  const value = useMemo(
    () => ({
      clockIn: todayRecord.clockIn,
      clockOut: todayRecord.clockOut,
      date: todayRecord.date,
      doClockIn,
      doClockOut,
      hasClockedIn: Boolean(todayRecord.clockIn),
      hasClockedOut: Boolean(todayRecord.clockOut),
      history,
      isLoading,
      getHistoryByDateRange,
      getAvailablePeriods,
      setClockRecord,
      pendingClocks: pendingClocks || [],
      submitPendingClock,
      approvePendingClock,
      rejectPendingClock,
    }),
    [todayRecord, doClockIn, doClockOut, history, isLoading, getHistoryByDateRange, getAvailablePeriods, setClockRecord, pendingClocks, submitPendingClock, approvePendingClock, rejectPendingClock],
  )

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

export function useClock() {
  const context = useContext(ClockContext)
  if (!context) {
    throw new Error('useClock must be used within an ClockProvider')
  }
  return context
}

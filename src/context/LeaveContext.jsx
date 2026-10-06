import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'

const LeaveContext = createContext(null)

export const DEFAULT_LEAVE_QUOTA = 12

// Saldo cuti + penyesuaian. Terpisah dari sesi (AuthContext) supaya
// halaman yang hanya butuh auth tidak ikut memuat data cuti.
export function LeaveProvider({ children }) {
  const { currentUser } = useAuth()
  const [leaveBalances, setLeaveBalances] = useState([])
  const [leaveAdjustments, setLeaveAdjustments] = useState([])

  useEffect(() => {
    if (!currentUser) {
      setLeaveBalances([])
      setLeaveAdjustments([])
      return
    }
    let cancelled = false
    const year = new Date().getFullYear()
    Promise.all([
      api(`/users/leave/balances?year=${year}`).catch(() => ({ balances: [] })),
      api(`/users/leave/adjustments/${currentUser.id}`).catch(() => ({ adjustments: [] })),
    ]).then(([bal, adj]) => {
      if (cancelled) return
      setLeaveBalances(bal.balances || [])
      setLeaveAdjustments(adj.adjustments || [])
    })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const refreshLeave = useCallback(async () => {
    if (!currentUser) return
    const year = new Date().getFullYear()
    try {
      const [bal, adj] = await Promise.all([
        api(`/users/leave/balances?year=${year}`),
        api(`/users/leave/adjustments/${currentUser.id}`),
      ])
      setLeaveBalances(bal.balances || [])
      setLeaveAdjustments(adj.adjustments || [])
    } catch {
      // ignore
    }
  }, [currentUser?.id])

  const getLeaveBalance = useCallback((userId, year) => {
    const y = year || new Date().getFullYear()
    const found = (leaveBalances || []).find((b) => b.userId === userId && b.year === y)
    if (found) {
      return {
        userId,
        year: y,
        totalQuota: found.totalQuota,
        used: found.used,
        remaining: Math.max(0, found.totalQuota - found.used),
      }
    }
    return {
      userId,
      year: y,
      totalQuota: DEFAULT_LEAVE_QUOTA,
      used: 0,
      remaining: DEFAULT_LEAVE_QUOTA,
    }
  }, [leaveBalances])

  const setLeaveQuota = useCallback(async (userId, year, totalQuota) => {
    const y = year || new Date().getFullYear()
    if (typeof totalQuota !== 'number' || totalQuota < 0) {
      return { ok: false, error: 'Quota tidak valid.' }
    }
    try {
      await api('/users/leave/balance', {
        method: 'PUT',
        body: { userId, year: y, totalQuota, used: 0 },
      })
      setLeaveBalances((prev) => {
        const list = prev || []
        const idx = list.findIndex((b) => b.userId === userId && b.year === y)
        const next = [...list]
        if (idx === -1) {
          next.push({ userId, year: y, totalQuota, used: 0 })
        } else {
          next[idx] = { ...next[idx], totalQuota }
        }
        return next
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  // Deduct / add-back diproses server-side saat status pengajuan cuti berubah.
  // Fungsi ini dipertahankan agar kompatibel, sekaligus refresh saldo lokal.
  const deductLeave = useCallback(async (userId, year, days) => {
    if (!userId || !days || days <= 0) return
    try {
      await api('/users/leave/deduct', {
        method: 'POST',
        body: { userId, year: year || new Date().getFullYear(), days },
      })
    } catch {
      // ignore
    }
    await refreshLeave()
  }, [refreshLeave])

  const addLeaveBack = useCallback(async (userId, year, days) => {
    if (!userId || !days || days <= 0) return
    try {
      await api('/users/leave/deduct', {
        method: 'POST',
        body: { userId, year: year || new Date().getFullYear(), days: -days },
      })
    } catch {
      // ignore
    }
    await refreshLeave()
  }, [refreshLeave])

  // Bulk adjust saldo cuti — untuk admin (mis. cuti bersama)
  const adjustLeaveQuota = useCallback(async ({ userIds, year, startDate, endDate, days, reason, adjustedBy }) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { ok: false, error: 'Pilih minimal satu karyawan.' }
    }
    const sd = String(startDate || '').trim()
    const ed = String(endDate || '').trim()
    if (!sd || !ed) {
      return { ok: false, error: 'Tanggal mulai dan tanggal selesai wajib diisi.' }
    }
    const d = Number(days)
    if (!Number.isFinite(d) || d <= 0 || !Number.isInteger(d)) {
      return { ok: false, error: 'Jumlah hari harus bilangan bulat positif.' }
    }
    const r = String(reason || '').trim()
    if (!r) {
      return { ok: false, error: 'Alasan penyesuaian wajib diisi.' }
    }
    const y = year || new Date().getFullYear()

    let successCount = 0
    for (const userId of userIds) {
      try {
        await api('/users/leave/adjust', {
          method: 'POST',
          body: { userId, year: y, startDate: sd, endDate: ed, days: d, reason: r },
        })
        successCount += 1
      } catch {
        // skip gagal
      }
    }
    await refreshLeave()
    return { ok: true, count: successCount }
  }, [refreshLeave])

  const getLeaveAdjustments = useCallback((userId, year) => {
    const y = year || new Date().getFullYear()
    return (leaveAdjustments || [])
      .filter((a) => a.userId === userId && a.year === y)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [leaveAdjustments])

  const value = useMemo(() => ({
    leaveBalances: leaveBalances || [],
    leaveAdjustments: leaveAdjustments || [],
    refreshLeave,
    getLeaveBalance,
    setLeaveQuota,
    adjustLeaveQuota,
    getLeaveAdjustments,
    deductLeave,
    addLeaveBack,
    defaultLeaveQuota: DEFAULT_LEAVE_QUOTA,
  }), [leaveBalances, leaveAdjustments, refreshLeave, getLeaveBalance, setLeaveQuota, adjustLeaveQuota, getLeaveAdjustments, deductLeave, addLeaveBack])

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>
}

export function useLeave() {
  const context = useContext(LeaveContext)
  if (!context) {
    throw new Error('useLeave must be used within a LeaveProvider')
  }
  return context
}
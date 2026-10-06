import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { useLeave } from './LeaveContext'

const PengajuanContext = createContext(null)

export const PENGAJUAN_TYPES = [
  { id: 'cuti', label: 'Cuti Tahunan' },
  { id: 'sakit', label: 'Sakit' },
  { id: 'lembur', label: 'Lembur' },
  { id: 'koreksi', label: 'Absen (Jam Kerja)' },
  { id: 'lainnya', label: 'Lainnya' },
]

// Calculate number of leave days between startDate and endDate (inclusive)
// Example: 27 Mei → 27 Mei = 1 hari, 27 Mei → 28 Mei = 2 hari
export function calculateLeaveDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

export function PengajuanProvider({ children }) {
  const [pengajuan, setPengajuan] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { currentUser } = useAuth()
  const { refreshLeave } = useLeave()

  useEffect(() => {
    if (!currentUser) {
      setPengajuan([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    api('/pengajuan')
      .then((res) => {
        if (!cancelled) setPengajuan(res.pengajuan || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser])

  const createPengajuan = useCallback(async ({ type, startDate, endDate, reason, clockInTime, clockOutTime }) => {
    if (!currentUser) return { ok: false, error: 'Anda harus login.' }
    if (!type || !startDate || !endDate || !reason?.trim()) {
      return { ok: false, error: 'Semua field wajib diisi.' }
    }
    if (type === 'koreksi' && (!clockInTime || !clockOutTime)) {
      return { ok: false, error: 'Jam masuk dan pulang wajib diisi.' }
    }
    if (type === 'lembur' && (!clockInTime || !clockOutTime)) {
      return { ok: false, error: 'Jam lembur wajib diisi.' }
    }
    try {
      const res = await api('/pengajuan', {
        method: 'POST',
        body: { type, startDate, endDate, reason: reason.trim(), clockInTime, clockOutTime },
      })
      setPengajuan((prev) => [res.item, ...(prev || [])])
      return { ok: true, item: res.item }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser])

  const updateStatus = useCallback(async (id, status, reviewer, rejectionReason) => {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return { ok: false, error: 'Status tidak valid.' }
    }
    try {
      const res = await api(`/pengajuan/${id}/status`, {
        method: 'PUT',
        body: { status, rejectionReason },
      })
      setPengajuan((prev) => prev.map((p) => (p.id === id ? res.item : p)))
      // Saldo cuti dihitung server-side; refresh saldo lokal
      refreshLeave()
      return { ok: true, item: res.item }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [refreshLeave])

  const deletePengajuan = useCallback(async (id) => {
    try {
      await api(`/pengajuan/${id}`, { method: 'DELETE' })
      setPengajuan((prev) => prev.filter((p) => p.id !== id))
      refreshLeave()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [refreshLeave])

  const getByUser = useCallback((userId) => {
    return (pengajuan || []).filter((p) => p.userId === userId)
  }, [pengajuan])

  const getById = useCallback((id) => {
    return (pengajuan || []).find((p) => p.id === id) || null
  }, [pengajuan])

  const value = useMemo(() => ({
    pengajuan: pengajuan || [],
    isLoading,
    createPengajuan,
    updateStatus,
    deletePengajuan,
    getByUser,
    getById,
    types: PENGAJUAN_TYPES,
  }), [pengajuan, isLoading, createPengajuan, updateStatus, deletePengajuan, getByUser, getById])

  return <PengajuanContext.Provider value={value}>{children}</PengajuanContext.Provider>
}

export function usePengajuan() {
  const context = useContext(PengajuanContext)
  if (!context) {
    throw new Error('usePengajuan must be used within a PengajuanProvider')
  }
  return context
}

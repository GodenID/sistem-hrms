import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  formatHolidayDate,
  HOLIDAY_CATEGORY_LABEL,
  HOLIDAY_CATEGORY_COLOR,
} from '../utils/holidays'

const HolidaysContext = createContext(null)

function pad2(n) { return String(n).padStart(2, '0') }

export function HolidaysProvider({ children }) {
  const [holidays, setHolidays] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  const fetchHolidays = useCallback(async ({ year, refresh } = {}) => {
    const y = year || new Date().getFullYear()
    try {
      const qs = new URLSearchParams({ year: String(y) })
      if (refresh) qs.set('refresh', '1')
      const res = await api(`/holidays?${qs.toString()}`)
      setHolidays(res.holidays || [])
      setRefreshError(null)
      return { ok: true, count: (res.holidays || []).length }
    } catch (err) {
      setRefreshError(err?.message || 'Gagal mengambil data hari libur.')
      return { ok: false, error: err?.message }
    }
  }, [])

  // Auto-fetch on mount untuk tahun berjalan + tahun depan
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchHolidays({}), fetchHolidays({ year: new Date().getFullYear() + 1 })])
      .then(([cur, next]) => {
        if (cancelled) return
        setHolidays((prev) => {
          const map = new Map()
          for (const h of prev || []) map.set(h.id, h)
          for (const h of (next.holidays || [])) map.set(h.id, h)
          return Array.from(map.values())
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manual refresh (untuk admin).
  const refreshHolidays = useCallback(async () => {
    setRefreshing(true)
    try {
      const year = new Date().getFullYear()
      const result = await fetchHolidays({ year, refresh: true })
      await fetchHolidays({ year: year + 1 })
      return result
    } finally {
      setRefreshing(false)
    }
  }, [fetchHolidays])

  const baseHolidays = useMemo(() => (holidays || []).filter((h) => h.isCustom !== true), [holidays])
  const customHolidays = useMemo(() => (holidays || []).filter((h) => h.isCustom === true), [holidays])

  const holidayMap = useMemo(() => new Map((holidays || []).map((h) => [h.date, h])), [holidays])

  const getHoliday = useCallback((dateStr) => {
    if (!dateStr) return null
    return holidayMap.get(dateStr) || null
  }, [holidayMap])

  const isHoliday = useCallback((dateStr) => holidayMap.has(dateStr), [holidayMap])

  const getUpcomingHolidays = useCallback((count = 3) => {
    const today = new Date().toISOString().slice(0, 10)
    return (holidays || []).filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, count)
  }, [holidays])

  const getHolidaysInRange = useCallback((startDate, endDate) => {
    return (holidays || []).filter((h) => h.date >= startDate && h.date <= endDate)
  }, [holidays])

  // CRUD for custom holidays
  const createCustom = useCallback(async ({ date, name, category = 'nasional' }) => {
    if (!date || !name?.trim()) return { ok: false, error: 'Tanggal dan nama wajib diisi.' }
    try {
      const res = await api('/holidays', {
        method: 'POST',
        body: { date, name: name.trim(), category },
      })
      setHolidays((prev) => {
        const list = (prev || []).filter((h) => h.date !== date)
        return [...list, res.holiday]
      })
      return { ok: true, item: res.holiday }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const updateCustom = useCallback(async (id, partial) => {
    const safe = { ...partial }
    delete safe.id
    delete safe.isCustom
    delete safe.createdAt
    try {
      const res = await api(`/holidays/${id}`, { method: 'PUT', body: safe })
      setHolidays((prev) => (prev || []).map((h) => (h.id === id ? res.holiday : h)))
      return { ok: true, item: res.holiday }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const deleteCustom = useCallback(async (id) => {
    try {
      await api(`/holidays/${id}`, { method: 'DELETE' })
      setHolidays((prev) => (prev || []).filter((h) => h.id !== id))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const getHolidaysForMonth = useCallback((year, month) => {
    const y = year || new Date().getFullYear()
    const m = month || new Date().getMonth() + 1
    const monthPrefix = `${y}-${pad2(m)}`
    return (holidays || []).filter((h) => h.date && h.date.startsWith(monthPrefix))
  }, [holidays])

  const value = useMemo(() => ({
    allHolidays: holidays || [],
    customHolidays,
    baseHolidays,
    getHoliday,
    isHoliday,
    getUpcomingHolidays,
    getHolidaysForMonth,
    getHolidaysInRange,
    createCustom,
    updateCustom,
    deleteCustom,
    refreshHolidays,
    refreshing,
    refreshError,
    holidaySource: 'api',
    lastFetchedAt: null,
    formatHolidayDate,
    categoryLabel: HOLIDAY_CATEGORY_LABEL,
    categoryColor: HOLIDAY_CATEGORY_COLOR,
  }), [holidays, customHolidays, baseHolidays, getHoliday, isHoliday, getUpcomingHolidays, getHolidaysForMonth, getHolidaysInRange, createCustom, updateCustom, deleteCustom, refreshHolidays, refreshing, refreshError])

  return <HolidaysContext.Provider value={value}>{children}</HolidaysContext.Provider>
}

export function useHolidays() {
  const context = useContext(HolidaysContext)
  if (!context) {
    throw new Error('useHolidays must be used within an HolidaysProvider')
  }
  return context
}
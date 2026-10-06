import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'

const EventsContext = createContext(null)

const DEFAULT_PO_THRESHOLDS = { kecilMax: 50000000, menengahMax: 200000000 }

function computePOCategory(amount, thresholds) {
  if (!amount || amount <= 0) return null
  const t = thresholds || DEFAULT_PO_THRESHOLDS
  if (amount <= t.kecilMax) return 'kecil'
  if (amount <= t.menengahMax) return 'menengah'
  return 'besar'
}

export function EventsProvider({ children }) {
  const [events, setEvents] = useState([])
  const [voucherCache, setVoucherCache] = useState({})
  const [poThresholds, setPoThresholds] = useState(DEFAULT_PO_THRESHOLDS)
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) {
      setEvents([])
      setVoucherCache({})
      setPoThresholds(DEFAULT_PO_THRESHOLDS)
      return
    }
    let cancelled = false
    Promise.all([
      api('/events').catch(() => ({ events: [] })),
      api('/events/po-thresholds').catch(() => ({ thresholds: DEFAULT_PO_THRESHOLDS })),
    ]).then(([e, t]) => {
      if (cancelled) return
      setEvents(e.events || [])
      setPoThresholds(t.thresholds || DEFAULT_PO_THRESHOLDS)
    })
    return () => {
      cancelled = true
    }
  }, [currentUser])

  const createEvent = useCallback(async ({ name, startDate, endDate, location, createdBy, manpower, status, poAmount }) => {
    try {
      const res = await api('/events', {
        method: 'POST',
        body: {
          name: name.trim(),
          startDate,
          endDate: endDate || startDate,
          location: location.trim(),
          createdBy,
          manpower: manpower || [],
          status: status || 'approved',
          poAmount: poAmount || 0,
        },
      })
      setEvents((prev) => [res.event, ...(prev || [])])
      return res.event
    } catch (err) {
      console.error('Create event gagal:', err.message)
      return null
    }
  }, [])

  const addVoucher = useCallback(async ({ eventId, name, roles }) => {
    try {
      const res = await api(`/events/${eventId}/vouchers`, {
        method: 'POST',
        body: { name: name.trim(), roles: roles || [] },
      })
      setVoucherCache((prev) => ({
        ...prev,
        [eventId]: [res.voucher, ...((prev[eventId] || []))],
      }))
      return res.voucher
    } catch (err) {
      console.error('Add voucher gagal:', err.message)
      return null
    }
  }, [])

  const getEventById = useCallback((id) => {
    return (events || []).find((e) => e.id === id) || null
  }, [events])

  const getVouchersByEvent = useCallback((eventId) => {
    return voucherCache[eventId] || []
  }, [voucherCache])

  const loadVouchers = useCallback(async (eventId) => {
    try {
      const res = await api(`/events/${eventId}/vouchers`)
      setVoucherCache((prev) => ({ ...prev, [eventId]: res.vouchers || [] }))
    } catch (err) {
      console.error('Load vouchers gagal:', err.message)
    }
  }, [])

  const updateEvent = useCallback(async (id, partial) => {
    try {
      const safe = { ...partial }
      delete safe.id
      const res = await api(`/events/${id}`, { method: 'PUT', body: safe })
      setEvents((prev) => prev.map((e) => (e.id === id ? res.event : e)))
      return { ok: true, event: res.event }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const deleteEvent = useCallback(async (id) => {
    try {
      await api(`/events/${id}`, { method: 'DELETE' })
      setEvents((prev) => prev.filter((e) => e.id !== id))
      setVoucherCache((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const setPOThresholds = useCallback(async (thresholds) => {
    try {
      const res = await api('/events/po-thresholds', { method: 'PUT', body: thresholds })
      setPoThresholds(res.thresholds || thresholds)
      return { ok: true }
    } catch (err) {
      console.error('Set PO thresholds gagal:', err.message)
      return { ok: false, error: err.message }
    }
  }, [])

  const value = useMemo(() => ({
    events: events || [],
    vouchers: getVouchersByEvent,
    poThresholds,
    setPOThresholds,
    computePOCategory: (amount) => computePOCategory(amount, poThresholds),
    createEvent,
    addVoucher,
    updateEvent,
    deleteEvent,
    getEventById,
    getVouchersByEvent,
    loadVouchers,
  }), [events, getVouchersByEvent, poThresholds, setPOThresholds, createEvent, addVoucher, updateEvent, deleteEvent, getEventById, loadVouchers])

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}

export function useEvents() {
  const context = useContext(EventsContext)
  if (!context) {
    throw new Error('useEvents must be used within an EventsProvider')
  }
  return context
}
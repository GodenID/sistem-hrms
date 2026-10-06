import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'

const AnnouncementsContext = createContext(null)

export const ANNOUNCEMENT_TYPES = [
  { id: 'info', label: 'Info', emoji: 'ℹ️', color: 'sky' },
  { id: 'important', label: 'Penting', emoji: '⚠️', color: 'amber' },
  { id: 'urgent', label: 'Mendesak', emoji: '🚨', color: 'rose' },
]

export function AnnouncementsProvider({ children }) {
  const [announcements, setAnnouncements] = useState([])
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) {
      setAnnouncements([])
      return
    }
    let cancelled = false
    api('/announcements')
      .then((res) => {
        if (!cancelled) setAnnouncements(res.announcements || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentUser])

  const createAnnouncement = useCallback(async ({ title, body, type }) => {
    if (!currentUser) return { ok: false, error: 'Anda harus login.' }
    if (!title?.trim() || !body?.trim()) {
      return { ok: false, error: 'Judul dan isi pengumuman wajib diisi.' }
    }
    if (!ANNOUNCEMENT_TYPES.some((t) => t.id === type)) {
      return { ok: false, error: 'Tipe pengumuman tidak valid.' }
    }
    try {
      const res = await api('/announcements', {
        method: 'POST',
        body: { title: title.trim(), body: body.trim(), type },
      })
      setAnnouncements((prev) => [res.announcement, ...(prev || [])])
      return { ok: true, item: res.announcement }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser])

  const updateAnnouncement = useCallback(async (id, partial) => {
    const safe = { ...partial }
    delete safe.id
    delete safe.createdBy
    delete safe.createdAt
    try {
      const res = await api(`/announcements/${id}`, { method: 'PUT', body: safe })
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? res.announcement : a)))
      return { ok: true, item: res.announcement }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const deleteAnnouncement = useCallback(async (id) => {
    try {
      await api(`/announcements/${id}`, { method: 'DELETE' })
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const markRead = useCallback(async (id) => {
    try {
      await api(`/announcements/${id}/read`, { method: 'POST' })
      setAnnouncements((prev) => (prev || []).map((a) => {
        if (a.id !== id || a.hasRead) return a
        return { ...a, hasRead: true, readCount: (a.readCount || 0) + 1 }
      }))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const fetchReads = useCallback(async (id) => {
    try {
      const res = await api(`/announcements/${id}/reads`)
      return { ok: true, data: res }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const getById = useCallback((id) => {
    return (announcements || []).find((a) => a.id === id) || null
  }, [announcements])

  const sortedAnnouncements = useMemo(() => {
    return [...(announcements || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [announcements])

  const typeMeta = useCallback((typeId) => {
    return ANNOUNCEMENT_TYPES.find((t) => t.id === typeId) || ANNOUNCEMENT_TYPES[0]
  }, [])

  const value = useMemo(() => ({
    announcements: sortedAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    markRead,
    fetchReads,
    getById,
    typeMeta,
    types: ANNOUNCEMENT_TYPES,
  }), [sortedAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, markRead, fetchReads, getById, typeMeta])

  return <AnnouncementsContext.Provider value={value}>{children}</AnnouncementsContext.Provider>
}

export function useAnnouncements() {
  const context = useContext(AnnouncementsContext)
  if (!context) {
    throw new Error('useAnnouncements must be used within an AnnouncementsProvider')
  }
  return context
}

import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import {
  showNotification as showBrowserNotification,
  isDocumentHidden,
  getPermissionStatus,
  PREF_STORAGE_KEY,
} from '../utils/browserNotifications'

const NotificationsContext = createContext(null)

const POLL_INTERVAL_MS = 15000

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const { currentUser } = useAuth()

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await api('/notifications')
      setNotifications(res.notifications || [])
    } catch (err) {
      // silent — polling berikutnya akan coba lagi
    }
  }, [currentUser])

  // Fetch awal + polling berkala supaya tetap segar antar perangkat
  useEffect(() => {
    if (!currentUser) {
      setNotifications([])
      return
    }
    loadNotifications()
    const timer = setInterval(loadNotifications, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [currentUser, loadNotifications])

  const myNotifications = useMemo(() => notifications || [], [notifications])

  // ---- Browser Notification: tampilkan notifikasi OS-level ketika tab di background ----
  const shownBrowserNotifIds = useRef(new Set())

  // Tentukan preferensi user (default: ON jika permission granted)
  const browserNotifEnabled = useMemo(() => {
    if (typeof localStorage === 'undefined') return true
    const pref = localStorage.getItem(PREF_STORAGE_KEY)
    // null = user belum pernah mengatur, default true
    return pref === null ? true : pref === 'true'
  }, [])

  useEffect(() => {
    if (!currentUser) return
    if (!browserNotifEnabled) return
    if (getPermissionStatus() !== 'granted') return
    if (!isDocumentHidden()) return

    const fresh = myNotifications.filter((n) => !shownBrowserNotifIds.current.has(n.id))
    if (fresh.length === 0) return
    fresh.forEach((n) => shownBrowserNotifIds.current.add(n.id))

    // Hanya tampilkan yang paling baru — agar tidak spam banyak notifikasi
    // saat tab kembali hidden dengan banyak antrian sekaligus.
    const latest = fresh[0]
    showBrowserNotification({
      title: latest.title,
      body: latest.body,
      tag: `hrms-${latest.refType || 'general'}-${latest.refId || latest.id}`,
      timeoutMs: 6000,
    })
  }, [myNotifications, currentUser, browserNotifEnabled])

  const unreadCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications],
  )

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    api(`/notifications/${id}/read`, { method: 'PUT' }).catch(() => {})
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    api('/notifications/read-all', { method: 'PUT' }).catch(() => {})
  }, [])

  const clearAll = useCallback(async () => {
    setNotifications([])
    api('/notifications', { method: 'DELETE' }).catch(() => {})
  }, [])

  // Remove a single notification entirely (used when user taps the notification)
  const dismiss = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    api(`/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  const value = useMemo(() => ({
    notifications: myNotifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    dismiss,
  }), [myNotifications, unreadCount, markRead, markAllRead, clearAll, dismiss])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
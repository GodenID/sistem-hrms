import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth, normalizeUser, pickAvatarColor } from './AuthContext'

const UsersContext = createContext(null)

// Migrate user records so every user has role + avatarColor
function migrateUsers(list) {
  if (!Array.isArray(list)) return []
  return list.map((u) => ({
    ...u,
    role: u.role || 'employee',
    avatarColor: u.avatarColor || pickAvatarColor(u.username),
    photo: u.photo || u.avatarUrl || null,
  }))
}

// Daftar user + operasi admin atas user. Terpisah dari sesi (AuthContext)
// supaya perubahan sesi tidak ikut memuat ulang daftar user.
export function UsersProvider({ children }) {
  const { currentUser, setSessionUser } = useAuth()
  const [users, setUsers] = useState([])

  const safeUsers = useMemo(() => migrateUsers(users), [users])

  useEffect(() => {
    if (!currentUser) {
      setUsers([])
      return
    }
    let cancelled = false
    api('/users')
      .then((res) => {
        if (!cancelled) setUsers(res.users || [])
      })
      .catch(() => {
        // Simpan list kosong, bukan hanya diri sendiri — supaya UI tidak
        // menampilkan "daftar cuma saya" yang menyesatkan. Data tetap
        // tersimpan di database; retry terjadi via refreshUsers.
        if (!cancelled) setUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const refreshUsers = useCallback(async () => {
    try {
      const { users: list } = await api('/users')
      setUsers(list)
    } catch {
      // gagal — list dibiarkan apa adanya, data tidak hilang dari DB
    }
  }, [])

  const updateUser = useCallback(async (id, partial) => {
    const safe = { ...partial }
    delete safe.id
    delete safe.username
    delete safe.password
    try {
      // Edit profil sendiri → endpoint self-service (tidak butuh admin).
      // Admin mengedit user lain → endpoint admin.
      const path = currentUser?.id === id ? '/auth/profile' : `/users/${id}`
      const res = await api(path, { method: 'PUT', body: safe })
      const user = normalizeUser(res.user)
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)))
      if (currentUser?.id === id) setSessionUser(user)
      return { ok: true, user }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser?.id, setSessionUser])

  const setUserRole = useCallback(async (id, role) => {
    if (!['employee', 'admin', 'superadmin'].includes(role)) {
      return { ok: false, error: 'Role tidak valid.' }
    }
    try {
      const res = await api(`/users/${id}/role`, { method: 'PATCH', body: { role } })
      const user = normalizeUser(res.user)
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)))
      if (currentUser?.id === id) setSessionUser(user)
      return { ok: true, user }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser?.id, setSessionUser])

  const getUserById = useCallback((id) => {
    return safeUsers.find((u) => u.id === id) || null
  }, [safeUsers])

  const deleteUser = useCallback(async (id) => {
    try {
      await api(`/users/${id}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((u) => u.id !== id))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const value = useMemo(() => ({
    users: safeUsers,
    refreshUsers,
    updateUser,
    setUserRole,
    deleteUser,
    getUserById,
    hasAnyAdmin: safeUsers.some((u) => u.role === 'admin'),
  }), [safeUsers, refreshUsers, updateUser, setUserRole, deleteUser, getUserById])

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}

export function useUsers() {
  const context = useContext(UsersContext)
  if (!context) {
    throw new Error('useUsers must be used within a UsersProvider')
  }
  return context
}
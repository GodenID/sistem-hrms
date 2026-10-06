import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api, setToken, clearToken, getToken } from '../services/api'

const AuthContext = createContext(null)

// Palette of avatar gradient colors (used in DirectoryPage, PengajuanPage, etc.)
const AVATAR_COLORS = ['indigo', 'fuchsia', 'sky', 'emerald', 'amber', 'rose', 'violet', 'cyan']

export function pickAvatarColor(seed) {
  let sum = 0
  for (const ch of String(seed || '')) sum += ch.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function normalizeUser(u) {
  if (!u) return u
  const rawJobs = u.primaryJobs ?? u.primary_jobs ?? []
  return {
    ...u,
    primaryJobs: Array.isArray(rawJobs) ? rawJobs : [],
    ktpVerified: Boolean(u.ktpVerified),
    avatarColor: u.avatarColor || pickAvatarColor(u.username),
    photo: u.photo || u.avatarUrl || null,
  }
}

// Sesi hanya — daftar user ada di UsersContext, saldo cuti di LeaveContext.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore sesi dari token di localStorage
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      const token = getToken()
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const { user } = await api('/auth/me')
        if (cancelled) return
        setCurrentUser(normalizeUser(user))
      } catch {
        clearToken()
        if (!cancelled) setCurrentUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const setSessionUser = useCallback((user) => {
    setCurrentUser(user ? normalizeUser(user) : null)
  }, [])

  const register = useCallback(async ({ fullName, ktp, username, password, division, birthPlace, birthDate, sex, address, ktpVerified, role: roleOverride }) => {
    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: {
          fullName, ktp: ktp || null, username, password, division: division || null,
          birthPlace: birthPlace || null, birthDate: birthDate || null, sex: sex || null,
          address: address || null, ktpVerified: Boolean(ktpVerified),
          ...(roleOverride ? { role: roleOverride } : {}),
        },
      })
      // First user jadi admin otomatis di sisi server (role resolution server-side)
      return { ok: true, user: normalizeUser(res.user) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const login = useCallback(async (username, password) => {
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: { username: String(username).trim(), password },
      })
      setToken(token)
      const normalized = normalizeUser(user)
      setCurrentUser(normalized)
      return { ok: true, user: normalized }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setCurrentUser(null)
  }, [])

  const verifyUsername = useCallback(async (username) => {
    try {
      await api('/auth/verify-username', {
        method: 'POST',
        body: { username: String(username || '').trim() },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const verifyKtp = useCallback(async (username, ktp) => {
    const k = String(ktp || '').trim()
    if (!k) {
      return { ok: false, error: 'Nomor KTP wajib diisi.' }
    }
    try {
      await api('/auth/verify-ktp', {
        method: 'POST',
        body: { username: String(username || '').trim(), ktp: k },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const resetPassword = useCallback(async (username, ktp, newPassword) => {
    const u = String(username || '').trim()
    const k = String(ktp || '').trim()
    if (!u || !k || !newPassword) {
      return { ok: false, error: 'Data tidak lengkap.' }
    }
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { username: u, ktp: k, newPassword },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    if (!currentUser) {
      return { ok: false, error: 'User tidak ditemukan.' }
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { oldPassword, newPassword },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser])

  const value = useMemo(() => ({
    user: currentUser?.username || null,
    currentUser,
    isLoading,
    login,
    logout,
    register,
    verifyUsername,
    verifyKtp,
    resetPassword,
    changePassword,
    setSessionUser,
    isAuthenticated: Boolean(currentUser),
    isAdmin: currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.userType === 'admin',
    isSuperadmin: currentUser?.role === 'superadmin',
  }), [currentUser, isLoading, login, logout, register, verifyUsername, verifyKtp, resetPassword, changePassword, setSessionUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
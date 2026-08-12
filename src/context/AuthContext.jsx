import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api, setToken, clearToken, getToken } from '../services/api'

const AuthContext = createContext(null)

// Palette of avatar gradient colors (used in DirectoryPage, PengajuanPage, etc.)
const AVATAR_COLORS = ['indigo', 'fuchsia', 'sky', 'emerald', 'amber', 'rose', 'violet', 'cyan']

export const DEFAULT_LEAVE_QUOTA = 12

function pickAvatarColor(seed) {
  let sum = 0
  for (const ch of String(seed || '')) sum += ch.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

// Migrate user records so every user has role + avatarColor
function migrateUsers(list) {
  if (!Array.isArray(list)) return []
  return list.map((u) => ({
    ...u,
    role: u.role || 'employee',
    avatarColor: u.avatarColor || pickAvatarColor(u.username),
  }))
}

function normalizeUser(u) {
  if (!u) return u
  return {
    ...u,
    ktpVerified: Boolean(u.ktpVerified),
    avatarColor: u.avatarColor || pickAvatarColor(u.username),
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [leaveBalances, setLeaveBalances] = useState([])
  const [leaveAdjustments, setLeaveAdjustments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const safeUsers = useMemo(() => migrateUsers(users), [users])

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
        const year = new Date().getFullYear()
        const [bal, adj] = await Promise.all([
          api(`/users/leave/balances?year=${year}`),
          api(`/users/leave/adjustments/${user.id}`),
        ])
        if (cancelled) return
        setLeaveBalances(bal.balances || [])
        setLeaveAdjustments(adj.adjustments || [])
        try {
          const { users: list } = await api('/users')
          if (cancelled) return
          setUsers(list)
        } catch {
          setUsers([user])
        }
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

  const refreshUsers = useCallback(async () => {
    try {
      const { users: list } = await api('/users')
      setUsers(list)
    } catch {
      // non-admin tetap pakai cache user dirinya
    }
  }, [])

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
  }, [currentUser])

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
      const user = normalizeUser(res.user)
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id)
        return exists ? prev : [...prev, user]
      })
      return { ok: true, user }
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
      const year = new Date().getFullYear()
      try {
        const [bal, adj, uList] = await Promise.all([
          api(`/users/leave/balances?year=${year}`),
          api(`/users/leave/adjustments/${user.id}`),
          api('/users'),
        ])
        setLeaveBalances(bal.balances || [])
        setLeaveAdjustments(adj.adjustments || [])
        setUsers(uList.users || [])
      } catch {
        setUsers([normalized])
      }
      return { ok: true, user: normalized }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setCurrentUser(null)
    setUsers([])
    setLeaveBalances([])
    setLeaveAdjustments([])
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
    const user = safeUsers.find((x) => x.username === String(username || '').trim())
    if (!user) {
      return { ok: false, error: 'Username tidak valid.' }
    }
    if ((user.ktp || '') !== k) {
      return { ok: false, error: 'Nomor KTP tidak sesuai dengan username.' }
    }
    return { ok: true }
  }, [safeUsers])

  const resetPassword = useCallback(async (username, ktp, newPassword) => {
    const u = String(username || '').trim()
    const k = String(ktp || '').trim()
    if (!u || !k || !newPassword) {
      return { ok: false, error: 'Data tidak lengkap.' }
    }
    const user = safeUsers.find((x) => x.username === u)
    if (!user) {
      return { ok: false, error: 'Username tidak ditemukan.' }
    }
    if ((user.ktp || '') !== k) {
      return { ok: false, error: 'Nomor KTP tidak sesuai.' }
    }
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { username: u, newPassword },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [safeUsers])

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

  const updateUser = useCallback(async (id, partial) => {
    const safe = { ...partial }
    delete safe.id
    delete safe.username
    delete safe.password
    try {
      const res = await api(`/users/${id}`, { method: 'PUT', body: safe })
      const user = normalizeUser(res.user)
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)))
      if (currentUser?.id === id) setCurrentUser(user)
      return { ok: true, user }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser])

  const setUserRole = useCallback(async (id, role) => {
    if (!['employee', 'admin'].includes(role)) {
      return { ok: false, error: 'Role tidak valid.' }
    }
    try {
      const res = await api(`/users/${id}/role`, { method: 'PATCH', body: { role } })
      const user = normalizeUser(res.user)
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)))
      if (currentUser?.id === id) setCurrentUser(user)
      return { ok: true, user }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [currentUser])

  const getUserById = useCallback((id) => {
    return safeUsers.find((u) => u.id === id) || null
  }, [safeUsers])

  // ============================================================
  // LEAVE BALANCE HELPERS
  // ============================================================

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

  // ============================================================
  // BULK ADJUST SALDO CUTI — untuk admin (mis. cuti bersama)
  // ============================================================

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
    user: currentUser?.username || null,
    currentUser,
    users: safeUsers,
    isLoading,
    leaveBalances: leaveBalances || [],
    leaveAdjustments: leaveAdjustments || [],
    login,
    logout,
    register,
    verifyUsername,
    verifyKtp,
    resetPassword,
    changePassword,
    updateUser,
    setUserRole,
    getUserById,
    getLeaveBalance,
    setLeaveQuota,
    adjustLeaveQuota,
    getLeaveAdjustments,
    deductLeave,
    addLeaveBack,
    refreshUsers,
    refreshLeave,
    defaultLeaveQuota: DEFAULT_LEAVE_QUOTA,
    isAuthenticated: Boolean(currentUser),
    isAdmin: currentUser?.role === 'admin' || currentUser?.userType === 'admin',
    hasAnyAdmin: safeUsers.some((u) => u.role === 'admin'),
  }), [currentUser, safeUsers, isLoading, leaveBalances, leaveAdjustments, login, logout, register, verifyUsername, verifyKtp,
      resetPassword, changePassword, updateUser, setUserRole, getUserById, refreshUsers, refreshLeave,
      getLeaveBalance, setLeaveQuota, adjustLeaveQuota, getLeaveAdjustments, deductLeave, addLeaveBack])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { api } from '../../services/api'
import { useAuth } from './AuthContext'

const UserContext = createContext(undefined)

const USERNAME_RE = /^[a-z0-9_]+$/

function validateJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    return 'Minimal 1 job utama wajib diisi'
  }
  if (jobs.length > 3) {
    return 'Maksimal 3 job utama'
  }
  for (const j of jobs) {
    const label = j.label.trim()
    if (label.length === 0) return 'Label job utama tidak boleh kosong'
    if (label.length > 50) return 'Label job utama maksimal 50 karakter'
    const type = j.type ?? 'standard'
    if (type === 'po') {
      if (!Number.isInteger(j.monthlyTargetIDR) || (j.monthlyTargetIDR ?? 0) < 1) {
        return 'Target nominal PO bulanan harus diisi (minimal Rp 1)'
      }
    } else {
      if (
        !Number.isInteger(j.dailyTarget) ||
        (j.dailyTarget ?? 0) < 1 ||
        (j.dailyTarget ?? 0) > 99
      ) {
        return 'Target harian setiap job harus 1-99'
      }
    }
  }
  return null
}

function validateUserShape(user, options) {
  const fullName = user.fullName.trim()
  if (fullName.length === 0) return 'Nama lengkap wajib diisi'
  if (fullName.length > 100) return 'Nama lengkap maksimal 100 karakter'

  const username = user.username.trim()
  if (username.length === 0) return 'Username wajib diisi'
  if (!USERNAME_RE.test(username))
    return 'Username hanya boleh huruf kecil, angka, dan underscore'
  if (username.length > 50) return 'Username maksimal 50 karakter'

  if (options.requirePassword) {
    const password = user.password ?? ''
    if (password.length === 0) return 'Password wajib diisi'
    if (password.length > 100) return 'Password maksimal 100 karakter'
  }

  const role = user.role.trim()
  if (role.length === 0) return 'Role/jabatan wajib diisi'
  if (role.length > 100) return 'Role maksimal 100 karakter'

  if (user.userType !== 'admin') {
    const jobsErr = validateJobs(user.jobs)
    if (jobsErr) return jobsErr
  }

  return null
}

export function UserProvider({ children }) {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { session } = useAuth()

  const loadUsers = useCallback(async () => {
    try {
      const res = await api('/okr/users')
      setUsers(res.users || [])
      return res.users || []
    } catch (err) {
      console.error('Gagal memuat user OKR:', err.message)
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api('/okr/users')
      .then((res) => {
        if (!cancelled) setUsers(res.users || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadUsers()
  }, [loadUsers])

  const getUserByUsername = useCallback(
    (username) => users.find((u) => u.username === username),
    [users]
  )

  const syncJobs = useCallback(async (username, jobs) => {
    for (const j of jobs || []) {
      const payload = {
        label: j.label,
        type: j.type ?? 'standard',
        dailyTarget: j.dailyTarget ?? null,
        monthlyTargetIDR: j.monthlyTargetIDR ?? null,
        clientType: j.clientType ?? null,
      }
      if (j.id && !String(j.id).includes('-legacy')) {
        await api(`/okr/users/${username}/jobs/${j.id}`, { method: 'PUT', body: payload })
      } else {
        await api(`/okr/users/${username}/jobs`, { method: 'POST', body: payload })
      }
    }
  }, [])

  const createUser = useCallback(
    async (user) => {
      const candidate = {
        ...user,
        username: user.username.trim(),
        fullName: user.fullName.trim(),
        role: user.role.trim(),
        userType: user.userType ?? 'karyawan',
        jobs: user.jobs?.map((j) => ({
          ...j,
          label: j.label.trim(),
        })),
      }

      const err = validateUserShape(candidate, { requirePassword: true })
      if (err) return { success: false, error: err }

      try {
        await api('/okr/users', {
          method: 'POST',
          body: {
            username: candidate.username,
            password: candidate.password,
            fullName: candidate.fullName,
            role: candidate.role,
            userType: candidate.userType,
          },
        })
        await syncJobs(candidate.username, candidate.jobs || [])
        const next = await loadUsers()
        setUsers(next)
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },
    [loadUsers, syncJobs]
  )

  const updateUser = useCallback(
    async (username, patch) => {
      const idx = users.findIndex((u) => u.username === username)
      if (idx === -1) {
        return { success: false, error: 'Pengguna tidak ditemukan' }
      }

      const merged = {
        ...users[idx],
        ...patch,
        username: (patch.username ?? users[idx].username).trim(),
        fullName: (patch.fullName ?? users[idx].fullName).trim(),
        role: (patch.role ?? users[idx].role).trim(),
        jobs: (patch.jobs ?? users[idx].jobs)?.map((j) => ({
          ...j,
          label: j.label.trim(),
        })),
      }

      if (merged.username !== users[idx].username) {
        return { success: false, error: 'Username tidak dapat diubah' }
      }

      const err = validateUserShape(merged, { requirePassword: false })
      if (err) return { success: false, error: err }

      try {
        const body = {
          fullName: merged.fullName,
          role: merged.role,
          userType: merged.userType,
        }
        if (patch.password) body.password = patch.password
        await api(`/okr/users/${username}`, { method: 'PUT', body })

        // Sinkronkan jobs: update yang masih ada, hapus yang tidak ada di daftar baru
        const currentJobs = users[idx].jobs || []
        const nextJobIds = new Set((merged.jobs || []).map((j) => j.id).filter(Boolean))
        for (const old of currentJobs) {
          if (old.id && !nextJobIds.has(old.id)) {
            await api(`/okr/users/${username}/jobs/${old.id}`, { method: 'DELETE' })
          }
        }
        await syncJobs(username, merged.jobs || [])

        const next = await loadUsers()
        setUsers(next)
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },
    [users, loadUsers, syncJobs]
  )

  const suspendUser = useCallback(
    async (username) => {
      if (session?.username === username) {
        return {
          success: false,
          error: 'Tidak dapat menangguhkan akun Anda sendiri',
        }
      }
      try {
        const res = await api(`/okr/users/${username}/suspend`, { method: 'PATCH' })
        setUsers(res.users || [])
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },
    [session]
  )

  const activateUser = useCallback(
    async (username) => {
      try {
        const res = await api(`/okr/users/${username}/activate`, { method: 'PATCH' })
        setUsers(res.users || [])
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },
    []
  )

  const deleteUser = useCallback(
    async (username) => {
      if (session?.username === username) {
        return {
          success: false,
          error: 'Tidak dapat menghapus akun Anda sendiri',
        }
      }
      const target = users.find((u) => u.username === username)
      if (!target) {
        return { success: false, error: 'Pengguna tidak ditemukan' }
      }
      if (target.userType === 'admin') {
        const adminCount = users.filter((u) => u.userType === 'admin').length
        if (adminCount <= 1) {
          return {
            success: false,
            error: 'Tidak dapat menghapus admin terakhir',
          }
        }
      }

      try {
        const res = await api(`/okr/users/${username}`, { method: 'DELETE' })
        setUsers(res.users || [])
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },
    [users, session]
  )

  const value = {
    users,
    isLoading,
    refresh,
    getUserByUsername,
    createUser,
    updateUser,
    suspendUser,
    activateUser,
    deleteUser,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUsers() {
  const ctx = useContext(UserContext)
  if (ctx === undefined) {
    throw new Error('useUsers must be used within a UserProvider')
  }
  return ctx
}
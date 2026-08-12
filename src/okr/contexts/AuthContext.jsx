import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuth as useHrmsAuth } from '../../context/AuthContext'

const AuthContext = createContext(undefined)

export function OkrAuthProvider({ children }) {
  const hrms = useHrmsAuth()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: load the OKR user list from the server, then resolve the current
  // OKR user from the active HRMS session. No re-login needed.
  useEffect(() => {
    if (!hrms.isAuthenticated) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    api('/okr/users')
      .then((res) => {
        if (cancelled) return
        const me = (res.users || []).find((u) => u.username === hrms.user)
        setCurrentUser(me || null)
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrms.user, hrms.isAuthenticated])

  const session = hrms.isAuthenticated
    ? {
        username: hrms.user,
        loginAt: new Date().toISOString(),
        hrmsUrl: window.location.origin,
      }
    : null

  const logout = useCallback(() => {
    hrms.logout()
    toast.success('Berhasil logout')
    navigate('/login')
  }, [hrms, navigate])

  const refreshCurrentUser = useCallback(() => {
    if (!hrms.isAuthenticated) return
    api('/okr/users')
      .then((res) => {
        const me = (res.users || []).find((u) => u.username === hrms.user)
        setCurrentUser(me || null)
      })
      .catch(() => {})
  }, [hrms])

  const value = {
    session,
    currentUser,
    isLoading,
    login: () => ({ success: false, error: 'Login dilakukan melalui HRMS' }),
    ssoLogin: () => ({ success: false, error: 'Login dilakukan melalui HRMS' }),
    logout,
    refreshCurrentUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an OkrAuthProvider')
  }
  return context
}
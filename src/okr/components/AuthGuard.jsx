import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Skeleton } from './ui/skeleton'

export default function AuthGuard({
  children,
  requireAuth = true,
  redirectIfAuth = false,
  adminOnly = false,
}) {
  const { session, currentUser, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return

    if (requireAuth && !session) {
      navigate('/login')
      return
    }

    if (redirectIfAuth && session) {
      navigate(currentUser?.userType === 'admin' ? '/okr/admin' : '/okr')
      return
    }

    if (adminOnly && session && currentUser?.userType !== 'admin') {
      navigate('/okr')
    }
  }, [
    isLoading,
    session,
    currentUser,
    requireAuth,
    redirectIfAuth,
    adminOnly,
    navigate,
  ])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
          <Skeleton className="mb-6 h-9 w-44" />
          <div className="mb-8 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  if (requireAuth && !session) {
    return null
  }

  if (redirectIfAuth && session) {
    return null
  }

  if (adminOnly && currentUser?.userType !== 'admin') {
    return null
  }

  return <>{children}</>
}

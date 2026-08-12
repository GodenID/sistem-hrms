import { Link, useLocation } from 'react-router-dom'
import { BarChart3, History, Home, LogOut, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'

export default function MobileBottomNav() {
  const pathname = useLocation().pathname
  const { currentUser, logout } = useAuth()

  if (!currentUser) return null
  if (currentUser.userType === 'admin') return null

  const items = [
    { href: '/okr', icon: Home, label: 'Beranda' },
    { href: '/okr/team', icon: Users, label: 'Tim' },
    { href: '/okr/stats', icon: BarChart3, label: 'Statistik' },
    { href: '/okr/history', icon: History, label: 'Riwayat' },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn('h-5 w-5', active && 'stroke-[2.5px]')}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}

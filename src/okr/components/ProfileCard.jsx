import React from 'react'
import { Calendar, HelpCircle, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDateIndonesian, getTimeBasedGreeting } from '../lib/dateUtils'
import { useWibToday } from '../hooks/useWibToday'
import { resetOnboardingTour } from './OnboardingTour'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { toast } from 'sonner'

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return (words[0]?.[0] ?? '').toUpperCase()
}

export default function ProfileCard() {
  const { currentUser, logout, isLoading } = useAuth()
  useWibToday()
  const todayDate = formatDateIndonesian(new Date())
  const greeting = getTimeBasedGreeting()

  if (isLoading || !currentUser) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const initials = getInitials(currentUser.fullName)

  const handleRestartTour = () => {
    resetOnboardingTour(currentUser.username, 'dashboard')
    toast.success('Tur akan dimulai ulang')
    setTimeout(() => {
      if (typeof window !== 'undefined') window.location.reload()
    }, 600)
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <Avatar className="h-16 w-16 border border-border">
          {currentUser.avatar && (
            <AvatarImage
              src={currentUser.avatar}
              alt={`Avatar ${currentUser.fullName}`}
            />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {greeting}
          </p>
          <h2 className="text-base font-semibold leading-tight tracking-tight">
            {currentUser.fullName}
          </h2>
          <Badge variant="secondary" className="font-medium">
            {currentUser.role}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            <span className="text-muted-foreground">Hari ini · </span>
            <span className="text-foreground">{todayDate}</span>
          </span>
        </div>

        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestartTour}
          className="-mt-1 h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Mulai Ulang Tur
        </Button>
      </CardContent>
    </Card>
  )
}

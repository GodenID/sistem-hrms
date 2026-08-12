import React from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, History, ListChecks, Users } from 'lucide-react'
import AuthGuard from '../components/AuthGuard'
import BackToHrms from '../components/BackToHrms'
import ProfileCard from '../components/ProfileCard'
import TargetCard from '../components/TargetCard'
import InputList from '../components/InputList'
import MobileFAB from '../components/MobileFAB'
import OnboardingTour from '../components/OnboardingTour'
import HolidayBanner, { WeekendBanner } from '../components/HolidayBanner'
import { useWibToday } from '../hooks/useWibToday'
import { getHoliday } from '../lib/holidays'
import { isWeekend } from '../lib/dateUtils'
import { Button } from '../components/ui/button'

export default function DashboardPage() {
  const handleFabClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dit:open-add'))
    }
  }

  const today = useWibToday()
  const holiday = getHoliday(today)
  const weekend = !holiday && isWeekend(today)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Daily Input Job Tracking
              </span>
              <BackToHrms className="ml-1" />
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button variant="outline" size="sm" asChild data-tour="team-link">
                <Link to="/okr/team">
                  <Users className="h-4 w-4" />
                  Tim
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild data-tour="stats-link">
                <Link to="/okr/stats">
                  <BarChart3 className="h-4 w-4" />
                  Statistik
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild data-tour="history-link">
                <Link to="/okr/history">
                  <History className="h-4 w-4" />
                  Riwayat
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10 animate-fade-in">
          {holiday && (
            <div className="mb-6">
              <HolidayBanner holiday={holiday} />
            </div>
          )}
          {weekend && (
            <div className="mb-6">
              <WeekendBanner />
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <aside className="space-y-6 lg:col-span-1">
              <div data-tour="profile-card">
                <ProfileCard />
              </div>
              <div data-tour="target-card">
                <TargetCard />
              </div>
            </aside>

            <section className="lg:col-span-2">
              <InputList />
            </section>
          </div>
        </main>

        <MobileFAB onClick={handleFabClick} />

        <OnboardingTour
          tourId="dashboard"
          steps={[
            {
              element: "[data-tour='profile-card']",
              popover: {
                title: 'Profil Anda',
                description: 'Profil singkat dan tombol logout di sini.',
              },
            },
            {
              element: "[data-tour='target-card']",
              popover: {
                title: 'Target Harian',
                description: 'Target dan progres pencapaian Anda hari ini.',
              },
            },
            {
              element: "[data-tour='input-list']",
              popover: {
                title: 'Input Hari Ini',
                description:
                  'Tambahkan pekerjaan yang sudah Anda selesaikan di sini.',
              },
            },
            {
              element: "[data-tour='add-button']",
              popover: {
                title: 'Tambah Input',
                description: 'Klik tombol ini untuk mencatat pekerjaan baru.',
              },
            },
            {
              element: "[data-tour='team-link']",
              popover: {
                title: 'Aktivitas Tim',
                description:
                  'Lihat progres rekan kerja Anda hari ini secara real-time.',
              },
            },
            {
              element: "[data-tour='stats-link']",
              popover: {
                title: 'Statistik',
                description:
                  'Pantau performa Anda dengan grafik dan analisis.',
              },
            },
            {
              element: "[data-tour='history-link']",
              popover: {
                title: 'Riwayat',
                description: 'Lihat riwayat input dari hari-hari sebelumnya.',
              },
            },
          ]}
        />
      </div>
    </AuthGuard>
  )
}

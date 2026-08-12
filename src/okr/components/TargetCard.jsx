import React, { useMemo } from 'react'
import {
  Briefcase,
  CalendarOff,
  CheckCircle2,
  Receipt,
  Target,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useInput } from '../contexts/InputContext'
import {
  computeJobStats,
  computePOMonthlyStats,
  formatIDR,
  OTHER_JOB_LABEL,
} from '../lib/jobs'
import { useWibToday } from '../hooks/useWibToday'
import { getHoliday } from '../lib/holidays'
import { isWeekend } from '../lib/dateUtils'
import AnimatedNumber from './AnimatedNumber'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { Skeleton } from './ui/skeleton'

const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

function formatMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-')
  const monthIdx = parseInt(m, 10) - 1
  const name = BULAN_INDONESIA[monthIdx] ?? ''
  return `${name} ${y}`
}

export default function TargetCard() {
  const { currentUser, isLoading: authLoading } = useAuth()
  const { inputList, isLoading: inputLoading } = useInput()
  const today = useWibToday()
  const holiday = getHoliday(today)
  const weekend = isWeekend(today)

  const isLoading = authLoading || inputLoading || !currentUser

  const stats = useMemo(() => {
    if (!currentUser) return null
    return computeJobStats(currentUser, inputList)
  }, [currentUser, inputList])

  const poStats = useMemo(() => {
    if (!currentUser) return null
    return computePOMonthlyStats(currentUser, today.slice(0, 7))
  }, [currentUser, today, inputList])

  if (isLoading || !stats) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-10" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    )
  }

  const poCard =
    poStats && poStats.jobs.length > 0 ? (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Receipt className="h-4 w-4" />
              Target PO · {formatMonthLabel(poStats.month)}
            </CardTitle>
            {poStats.allMet && (
              <Badge variant="success" className="gap-1.5 px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Tercapai
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {poStats.jobs.map(({ job, totalIDR, percentage, isMet, count }) => {
            const target = job.monthlyTargetIDR ?? 0
            return (
              <div key={job.id} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {job.label}
                    </span>
                    {job.clientType && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-medium"
                      >
                        {job.clientType}
                      </Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <AnimatedNumber
                      value={percentage}
                      format={(v) => `${Math.round(v)}%`}
                    />
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatIDR(totalIDR)}
                  </span>
                  <span className="tabular-nums">
                    dari {formatIDR(target)} · {count} PO
                  </span>
                </div>
                <Progress
                  value={percentage}
                  indicatorClassName={isMet ? 'bg-emerald-500' : 'bg-primary'}
                  className="h-1.5"
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    ) : null

  if (holiday) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4" />
                Target Hari Ini
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="text-3xl" aria-hidden>
                {holiday.emoji ?? '🎉'}
              </span>
              <p className="text-sm font-semibold tracking-tight">
                {holiday.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Hari ini libur nasional · Tidak ada target
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Boleh tetap mencatat, hanya kategori{' '}
                <span className="font-medium text-foreground">
                  {OTHER_JOB_LABEL}
                </span>{' '}
                yang dapat diinput.
              </p>
            </div>
          </CardContent>
        </Card>
        {poCard}
      </div>
    )
  }

  if (weekend) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4" />
                Target Hari Ini
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CalendarOff
                className="h-8 w-8 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="text-sm font-semibold tracking-tight">
                Akhir Pekan
              </p>
              <p className="text-xs text-muted-foreground">
                Hari libur · Tidak ada target untuk job utama
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Boleh tetap mencatat, hanya kategori{' '}
                <span className="font-medium text-foreground">
                  {OTHER_JOB_LABEL}
                </span>{' '}
                yang dapat diinput.
              </p>
            </div>
          </CardContent>
        </Card>
        {poCard}
      </div>
    )
  }

  const { jobs, otherCount, overallPercentage, allMet } = stats
  const metCount = jobs.filter((j) => j.isMet).length

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              Target Hari Ini
            </CardTitle>
            {jobs.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                <AnimatedNumber
                  value={overallPercentage}
                  format={(v) => `${Math.round(v)}%`}
                />
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {poStats && poStats.jobs.length > 0
                ? 'Tidak ada job utama harian — lihat target PO di bawah.'
                : 'Belum ada job utama yang ditetapkan'}
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {jobs.map(({ job, count, percentage, isMet }) => (
                <div key={job.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {job.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      <AnimatedNumber value={count} />/{job.dailyTarget ?? 0}
                      <span className="mx-1">·</span>
                      <AnimatedNumber
                        value={percentage}
                        format={(v) => `${Math.round(v)}%`}
                      />
                    </span>
                  </div>
                  <Progress
                    value={percentage}
                    indicatorClassName={isMet ? 'bg-emerald-500' : 'bg-primary'}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          )}

          {otherCount > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                {OTHER_JOB_LABEL}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                <AnimatedNumber value={otherCount} /> item
              </span>
            </div>
          )}

          {jobs.length > 0 && (
            <div className="pt-1">
              {allMet ? (
                <Badge variant="success" className="gap-1.5 px-2.5 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Target Tercapai
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-medium tabular-nums">
                  {metCount}/{jobs.length} job tercapai
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {poCard}
    </div>
  )
}

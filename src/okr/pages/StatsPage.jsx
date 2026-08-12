import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Flame,
  History,
  ListChecks,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AuthGuard from '../components/AuthGuard'
import BackToHrms from '../components/BackToHrms'
import AnimatedNumber from '../components/AnimatedNumber'
import { useAuth } from '../contexts/AuthContext'
import { getInputRange } from '../lib/storage'
import { formatDateStringIndonesian } from '../lib/dateUtils'
import { useWibToday } from '../hooks/useWibToday'
import { computeJobStats, getUserJobs } from '../lib/jobs'
import { isHoliday } from '../lib/holidays'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'

function formatShortDate(date) {
  // date is YYYY-MM-DD
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

/**
 * Streak = consecutive days BACK FROM YESTERDAY where ALL jobs were met.
 * Today is excluded so the user isn't punished mid-day for an unfinished
 * streak. Days with no data act as resets, except holidays which are
 * treated as transparent — they neither extend nor break the streak.
 *
 * Date arithmetic is done via UTC to keep the day math independent of the
 * device timezone. Stored date keys are WIB-days; day-diff is symmetric.
 */
function calculateCurrentStreak(allMetByDate, today) {
  let streak = 0
  const [yStr, mStr, dStr] = today.split('-')
  const baseUtcMs = Date.UTC(
    parseInt(yStr, 10),
    parseInt(mStr, 10) - 1,
    parseInt(dStr, 10)
  )
  for (let d = 1; d < 366; d++) {
    const dt = new Date(baseUtcMs - d * 86_400_000)
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const day = String(dt.getUTCDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    // Holidays are transparent — skip without breaking or extending.
    if (isHoliday(dateStr)) {
      continue
    }
    if (allMetByDate.get(dateStr) === true) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * Longest streak = longest consecutive run of "all jobs met" days across the
 * recorded date range. Gaps act as resets. Holidays are transparent — they
 * neither extend nor break the streak, which means working Mon, holiday Tue,
 * working Wed counts as a 2-day streak.
 *
 * Walks the FULL range from the earliest active date up to (and including)
 * today so we can apply the holiday-skip rule consistently.
 */
function calculateLongestStreak(allMetByDate, todayStr) {
  const sorted = Array.from(allMetByDate.keys()).sort()
  if (sorted.length === 0) return 0

  const [syStr, smStr, sdStr] = sorted[0].split('-')
  const startUtcMs = Date.UTC(
    parseInt(syStr, 10),
    parseInt(smStr, 10) - 1,
    parseInt(sdStr, 10)
  )
  const [eyStr, emStr, edStr] = todayStr.split('-')
  const endUtcMs = Date.UTC(
    parseInt(eyStr, 10),
    parseInt(emStr, 10) - 1,
    parseInt(edStr, 10)
  )

  let longest = 0
  let current = 0
  for (let cursor = startUtcMs; cursor <= endUtcMs; cursor += 86_400_000) {
    const dt = new Date(cursor)
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dt.getUTCDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (isHoliday(dateStr)) {
      // skip; don't reset, don't extend
      continue
    }
    if (allMetByDate.get(dateStr) === true) {
      current++
      if (current > longest) longest = current
    } else {
      current = 0
    }
  }
  return longest
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0]?.payload
  if (!data) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold tracking-tight text-popover-foreground">
        {data.formattedFull}
      </p>
      <p className="mt-1 text-muted-foreground tabular-nums">
        {data.itemCount} item · {data.percentage}%
      </p>
    </div>
  )
}

export default function StatsPage() {
  const { currentUser } = useAuth()
  // WIB-today; recomputes the chart anchor on day rollover.
  const today = useWibToday()
  const [allStats, setAllStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    let cancelled = false
    setIsLoading(true)

    // Pull every recorded input and aggregate per-day stats.
    getInputRange(currentUser.username, '1900-01-01', today)
      .then((items) => {
        if (cancelled) return
        const itemsByDate = new Map()
        for (const item of items) {
          const d = (item.workDate || item.date || '').slice(0, 10)
          if (!itemsByDate.has(d)) itemsByDate.set(d, [])
          itemsByDate.get(d).push(item)
        }

        const dayStatsByDate = new Map()
        const allMetByDate = new Map()
        let totalItems = 0
        let mostProductive = null

        for (const [date, dayItems] of itemsByDate) {
          if (dayItems.length === 0) continue

          const jobStats = computeJobStats(currentUser, dayItems)

          const stat = {
            date,
            itemCount: jobStats.totalCount,
            percentage: jobStats.overallPercentage,
            allMet: jobStats.allMet,
            formattedShort: formatShortDate(date),
            formattedFull: formatDateStringIndonesian(date),
          }

          dayStatsByDate.set(date, stat)
          allMetByDate.set(date, jobStats.allMet)
          totalItems += jobStats.totalCount

          if (
            mostProductive === null ||
            stat.itemCount > mostProductive.itemCount
          ) {
            mostProductive = stat
          }
        }

        const totalActiveDays = dayStatsByDate.size
        const averagePerDay =
          totalActiveDays === 0
            ? 0
            : Math.round((totalItems / totalActiveDays) * 10) / 10

        const currentStreak = calculateCurrentStreak(allMetByDate, today)
        const longestStreak = calculateLongestStreak(allMetByDate, today)

        // Achievement rate considers only days where the user actually logged.
        const metDays = Array.from(allMetByDate.values()).filter(Boolean).length
        const achievementRate =
          totalActiveDays === 0
            ? 0
            : Math.round((metDays / totalActiveDays) * 100)

        // Build last 30 days (filling missing ones with zeros). UTC math keeps
        // day arithmetic independent of the device timezone.
        const last30 = []
        const [yStr, mStr, dStr] = today.split('-')
        const baseUtcMs = Date.UTC(
          parseInt(yStr, 10),
          parseInt(mStr, 10) - 1,
          parseInt(dStr, 10)
        )
        for (let d = 29; d >= 0; d--) {
          const dt = new Date(baseUtcMs - d * 86_400_000)
          const y = dt.getUTCFullYear()
          const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
          const day = String(dt.getUTCDate()).padStart(2, '0')
          const dateStr = `${y}-${m}-${day}`

          const cached = dayStatsByDate.get(dateStr)
          if (cached) {
            last30.push(cached)
          } else {
            last30.push({
              date: dateStr,
              itemCount: 0,
              percentage: 0,
              allMet: false,
              formattedShort: formatShortDate(dateStr),
              formattedFull: formatDateStringIndonesian(dateStr),
            })
          }
        }

        setAllStats({
          totalActiveDays,
          totalItems,
          averagePerDay,
          mostProductive,
          currentStreak,
          longestStreak,
          achievementRate,
          last30,
        })
      })
      .catch(() => {
        if (!cancelled) setAllStats(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser, today])

  const chartData = useMemo(() => allStats?.last30 ?? [], [allStats])
  const userJobs = currentUser ? getUserJobs(currentUser) : []

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-background">
        {/* Top Header */}
        <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Daily Input Job Tracking
              </span>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button variant="outline" size="sm" asChild>
                <Link to="/okr">Beranda</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/okr/history">
                  <History className="h-4 w-4" />
                  Riwayat
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10 animate-fade-in">
          {/* Title */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  Statistik Pribadi
                </h1>
                <BackToHrms />
              </div>
              <p className="text-sm text-muted-foreground">
                Pantau performa Anda dari waktu ke waktu
              </p>
            </div>
          </div>

          {/* User's job chips */}
          {userJobs.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {userJobs.map((job) => (
                <Badge
                  key={job.id}
                  variant="outline"
                  className="gap-1.5 font-medium"
                >
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  <span>{job.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    · {job.dailyTarget}/hari
                  </span>
                </Badge>
              ))}
            </div>
          )}

          {/* Top stat cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              icon={<Calendar className="h-4 w-4" />}
              label="Total Hari Aktif"
              value={isLoading ? null : allStats?.totalActiveDays ?? 0}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total Item"
              value={isLoading ? null : allStats?.totalItems ?? 0}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Rata-rata / Hari"
              value={isLoading ? null : allStats?.averagePerDay ?? 0}
              decimals={1}
            />
            <StatCard
              icon={<Flame className="h-4 w-4 text-orange-500" />}
              label="Streak Saat Ini"
              value={isLoading ? null : allStats?.currentStreak ?? 0}
              format={(v) => `${Math.round(v)} hari`}
            />
          </div>

          {/* Achievement chart */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Pencapaian 30 Hari Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full rounded-lg" />
              ) : chartData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Belum ada data untuk ditampilkan
                </p>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 8, left: -20, bottom: 30 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="formattedShort"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
                      />
                      <Bar
                        dataKey="percentage"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      >
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.date}
                            fill={
                              entry.allMet
                                ? "hsl(142 71% 45%)"
                                : "hsl(var(--primary))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom highlight cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <HighlightCard
              icon={<Award className="h-5 w-5 text-emerald-600" />}
              title="Hari Terproduktif"
              loading={isLoading}
              empty={!allStats?.mostProductive}
              emptyText="Belum ada hari aktif"
            >
              {allStats?.mostProductive && (
                <>
                  <p className="text-xl font-bold tracking-tight tabular-nums">
                    {allStats.mostProductive.itemCount} item
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {allStats.mostProductive.formattedFull}
                  </p>
                </>
              )}
            </HighlightCard>

            <HighlightCard
              icon={<Trophy className="h-5 w-5 text-amber-500" />}
              title="Streak Terpanjang"
              loading={isLoading}
              empty={!allStats || allStats.longestStreak === 0}
              emptyText="Belum tercapai"
            >
              {allStats && allStats.longestStreak > 0 && (
                <>
                  <p className="text-xl font-bold tracking-tight tabular-nums">
                    {allStats.longestStreak} hari berturut
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pencapaian target tertinggi
                  </p>
                </>
              )}
            </HighlightCard>

            <HighlightCard
              icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />}
              title="Persentase Hari Tercapai"
              loading={isLoading}
              empty={!allStats || allStats.totalActiveDays === 0}
              emptyText="Belum ada data"
            >
              {allStats && allStats.totalActiveDays > 0 && (
                <>
                  <p className="text-xl font-bold tracking-tight tabular-nums">
                    {allStats.achievementRate}%
                  </p>
                  <div className="mt-1.5">
                    <Badge variant="secondary" className="font-medium tabular-nums">
                      dari {allStats.totalActiveDays} hari aktif
                    </Badge>
                  </div>
                </>
              )}
            </HighlightCard>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}

function StatCard({
  icon,
  label,
  value,
  decimals,
  format,
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {typeof value === 'number' ? (
              <AnimatedNumber
                value={value}
                decimals={decimals}
                format={format}
              />
            ) : (
              value
            )}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

function HighlightCard({
  icon,
  title,
  loading,
  empty,
  emptyText,
  children,
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">{emptyText ?? '—'}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

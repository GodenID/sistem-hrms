import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FileText, History, Search, X } from 'lucide-react'
import AuthGuard from '../components/AuthGuard'
import BackToHrms from '../components/BackToHrms'
import { useAuth } from '../contexts/AuthContext'
import { getInputRange } from '../lib/storage'
import { formatDateStringIndonesian } from '../lib/dateUtils'
import { useWibToday } from '../hooks/useWibToday'
import { getHoliday } from '../lib/holidays'
import { computeJobStats, getUserJobs } from '../lib/jobs'
import InputItem from '../components/InputItem'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'

export default function HistoryPage() {
  const { currentUser } = useAuth()
  const today = useWibToday()
  const [dateEntries, setDateEntries] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsByDate, setItemsByDate] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [detailSearchQuery, setDetailSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    let cancelled = false
    setIsLoading(true)
    getInputRange(currentUser.username, '1900-01-01', today)
      .then((items) => {
        if (cancelled) return
        const byDate = {}
        for (const item of items) {
          const d = (item.workDate || item.date || '').slice(0, 10)
          if (!byDate[d]) byDate[d] = []
          byDate[d].push(item)
        }
        setItemsByDate(byDate)

        const historicalDates = Object.keys(byDate)
          .filter((d) => d !== today)
          .sort((a, b) => b.localeCompare(a))

        const userJobs = getUserJobs(currentUser)
        const totalTarget = userJobs.reduce(
          (s, j) =>
            (j.type ?? 'standard') === 'standard' ? s + (j.dailyTarget ?? 0) : s,
          0
        )

        const entries = historicalDates.map((date) => {
          const items = byDate[date] || []
          const stats = computeJobStats(currentUser, items)
          const formattedDate = formatDateStringIndonesian(date)

          return {
            date,
            formattedDate,
            itemCount: stats.totalCount,
            totalTarget,
            percentage: stats.overallPercentage,
            allMet: stats.allMet,
          }
        })

        setDateEntries(entries)
      })
      .catch(() => {
        if (!cancelled) setDateEntries([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser, today])

  const handleDateClick = (date) => {
    setSelectedItems(itemsByDate[date] || [])
    setSelectedDate(date)
    setDetailSearchQuery('')
  }

  const handleBack = () => {
    setSelectedDate(null)
    setSelectedItems([])
    setDetailSearchQuery('')
  }

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return dateEntries
    const q = searchQuery.toLowerCase().trim()
    return dateEntries.filter((entry) => {
      if (entry.formattedDate.toLowerCase().includes(q)) return true
      const items = itemsByDate[entry.date] || []
      return items.some(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      )
    })
  }, [dateEntries, searchQuery, itemsByDate])

  const filteredSelectedItems = useMemo(() => {
    if (!detailSearchQuery.trim()) return selectedItems
    const q = detailSearchQuery.toLowerCase().trim()
    return selectedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    )
  }, [selectedItems, detailSearchQuery])

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-4 py-8 pb-24 md:px-8 md:py-10 md:pb-10 animate-fade-in">
          <Button variant="outline" size="sm" asChild className="mb-6">
            <Link to="/okr">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </Link>
          </Button>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <History className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Riwayat Input</h1>
              <BackToHrms />
            </div>
          </div>

          {selectedDate ? (
            <div className="animate-fade-in">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mb-4 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>

              <h2 className="mb-5 text-lg font-semibold tracking-tight">
                {formatDateStringIndonesian(selectedDate)}
              </h2>

              {selectedItems.length > 0 && (
                <div className="relative mb-5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan judul atau deskripsi"
                    className="pl-9 pr-9"
                    aria-label="Cari item pada tanggal ini"
                  />
                  {detailSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDetailSearchQuery('')}
                      aria-label="Bersihkan pencarian"
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {selectedItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <FileText
                        className="h-5 w-5 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tidak ada item pada tanggal ini
                    </p>
                  </CardContent>
                </Card>
              ) : filteredSelectedItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Search
                        className="h-5 w-5 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tidak ada hasil yang cocok dengan pencarian Anda
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredSelectedItems.map((item) => (
                    <InputItem
                      key={item.id}
                      item={item}
                      readOnly={true}
                      onEdit={() => {}}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
              ))}
            </div>
          ) : dateEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center px-4 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <History
                    className="h-6 w-6 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  Belum ada riwayat
                </h3>
                <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
                  Riwayat input dari hari-hari sebelumnya akan tampil di sini
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan tanggal, judul, atau deskripsi"
                  className="pl-9 pr-9"
                  aria-label="Cari riwayat input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Search
                        className="h-5 w-5 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tidak ada hasil yang cocok dengan pencarian Anda
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredEntries.map((entry) => {
                    const isComplete = entry.allMet
                    const entryHoliday = getHoliday(entry.date)
                    return (
                      <button
                        key={entry.date}
                        type="button"
                        onClick={() => handleDateClick(entry.date)}
                        className="group rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/20 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="truncate text-sm font-semibold tracking-tight">
                                {entry.formattedDate}
                              </h3>
                              {entryHoliday && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 font-medium text-amber-900"
                                >
                                  Libur Nasional
                                </Badge>
                              )}
                              <Badge
                                variant={isComplete ? 'success' : 'secondary'}
                                className="font-medium tabular-nums"
                              >
                                {entry.percentage}%
                              </Badge>
                            </div>
                            <Progress
                              value={entry.percentage}
                              indicatorClassName={
                                isComplete ? 'bg-emerald-500' : 'bg-primary'
                              }
                              className="h-1.5"
                            />
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {entry.itemCount} item
                              {entry.totalTarget > 0 && (
                                <>
                                  <span className="mx-1">·</span>
                                  Total target {entry.totalTarget}
                                </>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}

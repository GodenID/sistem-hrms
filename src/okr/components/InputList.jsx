import React, { useEffect, useState } from 'react'
import { AlertCircle, Plus, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useInput } from '../contexts/InputContext'
import { getUserJobs, isPOJob } from '../lib/jobs'
import { useWibToday } from '../hooks/useWibToday'
import { isWeekend } from '../lib/dateUtils'
import { getHoliday } from '../lib/holidays'
import InputItemComponent from './InputItem'
import InputForm from './InputForm'
import EmptyState from './EmptyState'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

function InputItemSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3 w-20 mt-1" />
        </div>
      </div>
    </div>
  )
}

export default function InputList() {
  const { currentUser } = useAuth()
  const { inputList, addItem, storageError, clearStorageError, isLoading } =
    useInput()

  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    const handler = () => setShowAddForm(true)
    window.addEventListener('dit:open-add', handler)
    return () => window.removeEventListener('dit:open-add', handler)
  }, [])

  const handleAdd = (data) => {
    const success = addItem(data)
    if (success) {
      setShowAddForm(false)
    }
    return success
  }

  const today = useWibToday()
  const holiday = getHoliday(today)
  const weekend = isWeekend(today)
  const isOffDay = !!holiday || weekend
  const userJobs = currentUser
    ? getUserJobs(currentUser).filter((j) => !isPOJob(j))
    : []
  const formJobs = isOffDay ? [] : userJobs

  return (
    <Card data-tour="input-list">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2.5">
          <CardTitle className="text-lg">Input Hari Ini</CardTitle>
          {!isLoading && inputList.length > 0 && (
            <Badge variant="secondary" className="font-medium tabular-nums">
              {inputList.length}
            </Badge>
          )}
        </div>
        {!showAddForm && !isLoading && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
            data-tour="add-button"
          >
            <Plus className="h-4 w-4" />
            Tambah Input
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {storageError && (
          <div
            className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 animate-slide-up"
            role="alert"
          >
            <div className="flex items-start gap-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-snug">Gagal menyimpan data ke server</span>
            </div>
            <button
              type="button"
              onClick={clearStorageError}
              className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Tutup notifikasi error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-2.5">
            <InputItemSkeleton />
            <InputItemSkeleton />
            <InputItemSkeleton />
          </div>
        )}

        {!isLoading && showAddForm && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 animate-slide-up">
            {isOffDay && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                Hari libur — input dibatasi ke kategori{' '}
                <span className="font-semibold">Lainnya</span> saja.
              </div>
            )}
            <InputForm
              mode="add"
              jobs={formJobs}
              onSubmit={handleAdd}
              onCancel={() => setShowAddForm(false)}
              autoSave={true}
              username={currentUser?.username}
            />
          </div>
        )}

        {!isLoading && inputList.length === 0 && !showAddForm && (
          <EmptyState onAddClick={() => setShowAddForm(true)} />
        )}

        {!isLoading && inputList.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {inputList.map((item) => (
              <InputItemComponent
                key={item.id}
                item={item}
                readOnly
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

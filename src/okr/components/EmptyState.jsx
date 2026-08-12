import React from 'react'
import { Inbox, Plus } from 'lucide-react'
import { Button } from './ui/button'

export default function EmptyState({ onAddClick }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center animate-fade-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
      </div>

      <h3 className="text-base font-semibold tracking-tight">
        Belum ada input
      </h3>
      <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">
        Mulai catat pekerjaan pertamamu hari ini
      </p>

      <Button onClick={onAddClick} className="mt-5">
        <Plus className="h-4 w-4" />
        Tambah Input Pertama
      </Button>
    </div>
  )
}

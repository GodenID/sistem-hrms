import { CalendarOff, Sparkles } from 'lucide-react'
import { Card, CardContent } from './ui/card'

export default function HolidayBanner({ holiday }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-base">
          {holiday.emoji ?? <Sparkles className="h-4 w-4 text-amber-700" />}
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-semibold tracking-tight text-amber-950">
            Hari ini libur nasional — {holiday.name}
          </p>
          <p className="text-xs text-amber-800/80">
            Tidak ada target hari ini. Kamu masih bisa mencatat untuk kategori{' '}
            <span className="font-semibold">Lainnya</span> jika diperlukan.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function WeekendBanner() {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <CalendarOff
            className="h-4 w-4 text-amber-700"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-semibold tracking-tight text-amber-950">
            Akhir pekan — Hari libur
          </p>
          <p className="text-xs text-amber-800/80">
            Tidak ada target untuk job utama. Kamu masih bisa mencatat untuk
            kategori <span className="font-semibold">Lainnya</span> jika
            diperlukan.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

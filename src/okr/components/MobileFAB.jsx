import { Plus } from 'lucide-react'
import { cn } from '../lib/utils'

export default function MobileFAB({ onClick, visible = true, label = 'Tambah Input' }) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'md:hidden fixed bottom-20 right-4 z-30',
        'h-14 w-14 rounded-full bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/30',
        'flex items-center justify-center',
        'active:scale-95 transition-transform',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      aria-label={label}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}

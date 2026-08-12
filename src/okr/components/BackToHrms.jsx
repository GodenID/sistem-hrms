import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

export default function BackToHrms({ className, children }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {children || 'Kembali ke Menu HRMS'}
    </Link>
  )
}

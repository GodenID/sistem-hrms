import React from 'react'
import { Clock, Pencil, Trash2 } from 'lucide-react'
import { OTHER_JOB_LABEL, formatIDR } from '../lib/jobs'
import { formatTimeWib } from '../lib/dateUtils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export default function InputItem({
  item,
  onEdit,
  onDelete,
  readOnly = false,
}) {
  const formattedTime = formatTimeWib(item.timestamp)

  const hasJob = !!item.jobLabel
  const badgeLabel = hasJob ? item.jobLabel : OTHER_JOB_LABEL
  const badgeVariant = hasJob ? 'secondary' : 'outline'

  const hasNominal =
    typeof item.nominalIDR === 'number' &&
    Number.isFinite(item.nominalIDR) &&
    item.nominalIDR > 0

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold leading-snug tracking-tight">
              {item.title}
            </h3>
            <Badge variant={badgeVariant} className="font-medium">
              {badgeLabel}
            </Badge>
            {hasNominal && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700"
              >
                {formatIDR(item.nominalIDR)}
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-sm leading-relaxed text-muted-foreground break-words">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{formattedTime}</span>
          </div>
        </div>

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(item)}
              aria-label={`Hapus ${item.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="card grid grid-cols-3 divide-x divide-slate-200 p-0">
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-3 py-3">
          <Skeleton className="mx-auto h-3 w-10 rounded" />
          <Skeleton className="mx-auto mt-2 h-6 w-8 rounded" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCalendar() {
  return (
    <div className="animate-pulse">
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'

function formatLiveTime() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss}`
  return { dateStr, timeStr }
}

export default function LiveClock() {
  const [live, setLive] = useState(() => formatLiveTime())

  useEffect(() => {
    const id = setInterval(() => setLive(formatLiveTime()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card mb-6 overflow-hidden p-7 animate-slide-up">
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
        </span>
        Live Time
      </div>
      <p className="text-center font-mono text-5xl font-extrabold tracking-tight text-slate-900">
        {live.timeStr}
      </p>
      <p className="mt-2 text-center text-sm font-semibold text-slate-500">
        {live.dateStr}
      </p>
    </div>
  )
}

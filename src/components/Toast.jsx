import React, { useEffect, useState } from 'react'

const ICONS = {
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const COLORS = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200/80',
    icon: 'text-emerald-600',
    text: 'text-emerald-900',
    bar: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-50 border-red-200/80',
    icon: 'text-red-500',
    text: 'text-red-900',
    bar: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200/80',
    icon: 'text-amber-600',
    text: 'text-amber-900',
    bar: 'bg-amber-500',
  },
  info: {
    bg: 'bg-sky-50 border-sky-200/80',
    icon: 'text-sky-600',
    text: 'text-sky-900',
    bar: 'bg-sky-500',
  },
}

function ToastItem({ id, type, message, onDismiss, duration = 4000 }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(id), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [id, duration, onDismiss])

  const c = COLORS[type] || COLORS.info

  const handleClose = () => {
    setExiting(true)
    setTimeout(() => onDismiss(id), 300)
  }

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border ${c.bg} rounded-2xl px-4 py-3.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${
        exiting ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
      role="alert"
    >
      <span className={`mt-0.5 flex-shrink-0 ${c.icon}`}>{ICONS[type] || ICONS.info}</span>
      <p className={`flex-1 text-sm font-semibold leading-relaxed ${c.text}`}>{message}</p>
      <button
        type="button"
        onClick={handleClose}
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 ${c.text}`}
        aria-label="Tutup"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-5">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

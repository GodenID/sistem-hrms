import React, { useEffect } from 'react'

export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      />
      {/* Panel — flex column dengan header & footer fixed, content scrollable */}
      <div className="relative flex max-h-[90vh] w-full max-w-mobile animate-slide-up flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-3xl sm:m-4">
        {/* Header — sticky di atas */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 pb-4 pt-5">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* Footer — sticky di bawah (jika ada) */}
        {footer && (
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-6 pb-5 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

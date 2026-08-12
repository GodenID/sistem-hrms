import React from 'react'
import Modal from './Modal'

const VARIANT_STYLES = {
  danger: 'bg-rose-600 hover:bg-rose-700 shadow-[0_10px_30px_-10px_rgba(225,29,72,0.5)]',
  warning: 'bg-amber-600 hover:bg-amber-700 shadow-[0_10px_30px_-10px_rgba(217,119,6,0.5)]',
  default: 'bg-indigo-600 hover:bg-indigo-700 shadow-sm',
}

const VARIANT_ICON_BG = {
  danger: 'bg-rose-50 text-rose-600',
  warning: 'bg-amber-50 text-amber-600',
  default: 'bg-indigo-50 text-indigo-600',
}

const VARIANT_ICON = {
  danger: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
    </svg>
  ),
  default: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'default',
  loading = false,
}) {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.default
  const iconBgClass = VARIANT_ICON_BG[variant] || VARIANT_ICON_BG.default
  const Icon = VARIANT_ICON[variant] || VARIANT_ICON.default

  return (
    <Modal open={open} onClose={onClose} title={null}>
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconBgClass}`}>
          {Icon}
        </div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        {detail && (
          <div className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700">
            {detail}
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-70 ${variantClass}`}
        >
          {loading ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

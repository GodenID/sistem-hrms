import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000)
    },
  })

  const close = () => setNeedRefresh(false)

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto w-full max-w-mobile rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-bold text-slate-900">Versi baru tersedia</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">HRMS sudah update. Muat ulang untuk pakai versi terbaru.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => updateServiceWorker(true)} className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
            Muat Ulang
          </button>
          <button onClick={close} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
            Nanti
          </button>
        </div>
      </div>
    </div>
  )
}

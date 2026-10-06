import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
      <div className="animate-blob-a pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/45 via-violet-200/30 to-transparent blur-3xl" aria-hidden="true" />
      <div className="animate-blob-b pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-200/40 via-pink-200/30 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-mobile animate-slide-up text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.4)]">
          <span className="font-display text-3xl font-bold">404</span>
        </div>
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
          Alamat yang kamu buka tidak tersedia atau sudah dipindahkan. Periksa kembali URL atau kembali ke dashboard.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l18 0M3 12l6 -6M3 12l6 6" />
            </svg>
            Kembali ke Dashboard
          </Link>
          <Link
            to="/login"
            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Ke Halaman Login
          </Link>
        </div>
        <p className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
          Prasasti Connect · HRMS
        </p>
      </div>
    </div>
  )
}

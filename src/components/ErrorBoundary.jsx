import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10">
          <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
          <div className="relative w-full max-w-mobile animate-slide-up text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="mt-5 text-lg font-bold text-slate-900">Terjadi Kesalahan</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              Aplikasi mengalami gangguan tak terduga. Coba muat ulang. Jika masih berlanjut, hubungi admin.
            </p>
            {this.state.error?.message && (
              <pre className="mx-auto mt-4 max-w-full overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-[11px] text-slate-600">
                {String(this.state.error.message).slice(0, 400)}
              </pre>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                Muat Ulang
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

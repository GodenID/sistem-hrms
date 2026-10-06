import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LogoMark() {
  return (
    <div className="relative">
      {/* Soft glow halo behind mark */}
      <div className="absolute inset-0 -m-4 rounded-full bg-indigo-300/40 blur-2xl" aria-hidden="true" />
      {/* Organic blob shape — not a rigid square */}
      <div className="animate-breathe relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28%_72%_70%_30%/30%_30%_70%_70%] bg-indigo-600 shadow-[0_18px_40px_-12px_rgba(99,102,241,0.55)]">
        {/* Inner highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-white/30 mix-blend-overlay" aria-hidden="true" />
        {/* Stylized italic P */}
        <span className="font-display relative text-4xl italic font-bold text-white drop-shadow-sm">P</span>
        {/* Tiny accent dot */}
        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
      </div>
    </div>
  )
}

function Sparkles() {
  return (
    <>
      <span className="animate-sparkle absolute left-[18%] top-[18%] h-1.5 w-1.5 rounded-full bg-indigo-400/70" aria-hidden="true" />
      <span className="animate-sparkle-delay absolute right-[20%] top-[28%] h-1 w-1 rounded-full bg-fuchsia-400/70" aria-hidden="true" />
      <span className="animate-sparkle-delay-2 absolute left-[24%] bottom-[28%] h-1 w-1 rounded-full bg-sky-400/70" aria-hidden="true" />
      <span className="animate-sparkle absolute right-[16%] bottom-[22%] h-1.5 w-1.5 rounded-full bg-violet-400/60" aria-hidden="true" />
    </>
  )
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 320)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.')
      triggerShake()
      return
    }

    setLoading(true)
    try {
      const result = await login(username.trim(), password)
      if (!result.ok) {
        setError(result.error || 'Username atau password salah.')
        triggerShake()
        return
      }
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-white px-5 py-10">
      {/* Layered background: dotted grid + soft floating gradient blobs */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" aria-hidden="true" />
      <div
        className="animate-blob-a pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/55 via-violet-200/40 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-blob-b pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-gradient-to-br from-fuchsia-200/50 via-pink-200/35 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-blob-c pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-gradient-to-br from-sky-200/45 via-cyan-200/30 to-transparent blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-mobile animate-slide-up">
        {/* Brand header */}
        <div className="relative mb-9 flex flex-col items-center text-center">
          <Sparkles />
          <LogoMark />

          <h1 className="font-display mt-6 text-[2.6rem] leading-none font-bold tracking-tight text-slate-900">
            <span className="italic">Prasasti</span>{' '}
            <span className="text-indigo-600">Connect</span>
          </h1>

          {/* Subtitle: small mono pill chip */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              HRMS
            </span>
            <span className="h-1 w-px bg-slate-300" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Mobile
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Sistem Manajemen Karyawan
          </p>
        </div>

        {/* Card */}
        <div className={`card p-7 ${shake ? 'animate-shake' : ''}`}>
          <div className="mb-5">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
              Selamat Datang Kembali
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Masuk untuk melanjutkan absensi hari ini
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Username
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`block w-full rounded-xl border bg-slate-50/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-slate-200 focus:border-indigo-400'}`}
                  placeholder="Masukkan username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600 hover:text-indigo-700"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full rounded-xl border bg-slate-50/50 py-3.5 pl-12 pr-12 text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-slate-200 focus:border-indigo-400'}`}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
              atau
            </span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          <p className="mt-5 text-center text-sm text-slate-600">
            Belum punya akun?{' '}
            <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-700">
              Daftar di sini
            </Link>
          </p>
        </div>

        {/* Footer micro-mark */}
        <p className="mt-6 text-center font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-slate-400">
          © {new Date().getFullYear()} Prasasti Connect
        </p>
      </div>
    </div>
  )
}

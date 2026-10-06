import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validatePassword, validateKtp } from '../utils/validation'

const STEPS = [
  { id: 1, label: 'Username', icon: 'user' },
  { id: 2, label: 'Verifikasi KTP', icon: 'card' },
  { id: 3, label: 'Password Baru', icon: 'lock' },
]

function StepIndicator({ current }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-2">
      {STEPS.map((s, i) => {
        const isDone = current > s.id
        const isActive = current === s.id
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                  isDone
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isActive
                    ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-500/20'
                    : 'border border-slate-200 bg-white text-slate-400',
                ].join(' ')}
              >
                {isDone ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.id
                )}
              </div>
              <span
                className={[
                  'mt-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
                  isActive ? 'text-slate-700' : isDone ? 'text-indigo-600' : 'text-slate-400',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'mb-5 h-px w-10 transition-colors duration-300 sm:w-14',
                  current > s.id ? 'bg-indigo-600' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function PasswordStrengthMeter({ score, maxScore }) {
  const labels = ['Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
  const color = colors[Math.min(score, colors.length - 1)]
  const label = labels[Math.min(score, labels.length - 1)]
  const percent = Math.max(8, (score / maxScore) * 100)
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}

function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500"
      >
        <span>{label}</span>
        {hint && <span className="font-mono text-[10px] font-medium normal-case tracking-normal text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const { verifyUsername, verifyKtp, resetPassword } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [ktp, setKtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const passwordCheck = validatePassword(newPassword)

  const handleStep1 = async (e) => {
    e.preventDefault()
    setError('')
    const result = await verifyUsername(username)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setStep(2)
  }

  const handleStep2 = async (e) => {
    e.preventDefault()
    setError('')
    const ktpCheck = validateKtp(ktp)
    if (!ktpCheck.isValid) {
      setError(ktpCheck.error)
      return
    }
    const result = await verifyKtp(username, ktp)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setStep(3)
  }

  const handleStep3 = async (e) => {
    e.preventDefault()
    setError('')

    if (!passwordCheck.isStrong) {
      setError('Password belum memenuhi syarat kekuatan.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setSubmitting(true)
    try {
      const result = await resetPassword(username, ktp, newPassword)
      if (!result.ok) {
        setError(result.error || 'Gagal memperbarui password.')
        // If data integrity issue, kick back to step 1
        if (result.error && result.error.includes('tidak ditemukan')) setStep(1)
        if (result.error && result.error.includes('KTP')) setStep(2)
        return
      }
      setDone(true)
      setTimeout(() => navigate('/login'), 1600)
    } finally {
      setSubmitting(false)
    }
  }

  const stepTitle = STEPS[step - 1]?.label || ''

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-white px-5 py-10">
      {/* Background — same canvas as login for consistency */}
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
        <div className="relative mb-7 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[28%_72%_70%_30%/30%_30%_70%_70%] bg-indigo-600 shadow-[0_14px_32px_-10px_rgba(99,102,241,0.55)]">
            <span className="font-display text-2xl italic font-bold text-white">P</span>
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-slate-900">
            <span className="italic">Prasasti</span>{' '}
            <span className="text-indigo-600">Connect</span>
          </h1>
          <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
            Reset Password
          </p>
        </div>

        {/* Step indicator */}
        {!done && <StepIndicator current={step} />}

        {/* Card */}
        <div className="card p-7">
          {done ? (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_14px_32px_-10px_rgba(16,185,129,0.55)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Password Berhasil Diubah</h2>
              <p className="mt-2 text-sm text-slate-600">
                Anda sekarang bisa masuk dengan password baru.
              </p>
              <p className="mt-4 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Mengalihkan ke halaman login...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Langkah {step} dari {STEPS.length}
                </p>
                <h2 className="mt-1 text-[15px] font-bold tracking-tight text-slate-900">
                  {stepTitle}
                </h2>
              </div>

              {step === 1 && (
                <form onSubmit={handleStep1} className="space-y-4 animate-fade-in">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Masukkan username yang Anda daftarkan. Kami akan memverifikasi bahwa akun tersebut
                    ada di sistem.
                  </p>
                  <Field label="Username" htmlFor="username">
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
                        autoFocus
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="Masukkan username Anda"
                        autoComplete="username"
                      />
                    </div>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Link
                      to="/login"
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                    >
                      Batal
                    </Link>
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98]"
                    >
                      <span className="relative">Lanjut</span>
                    </button>
                  </div>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleStep2} className="space-y-4 animate-fade-in">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Demi keamanan, masukkan <span className="font-bold text-slate-700">Nomor KTP</span> yang
                    terdaftar pada akun <span className="font-bold text-slate-700">{username}</span>.
                  </p>
                  <Field
                    label="Nomor KTP"
                    htmlFor="ktp"
                    hint={`${ktp.length}/16 digit`}
                  >
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                        </svg>
                      </div>
                      <input
                        id="ktp"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={ktp}
                        onChange={(e) => setKtp(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        autoFocus
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 font-mono tracking-wider text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="16 digit angka"
                        maxLength={16}
                      />
                    </div>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setStep(1)
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98]"
                    >
                      <span className="relative">Verifikasi</span>
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <form onSubmit={handleStep3} className="space-y-4 animate-fade-in">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Buat password baru yang kuat untuk akun Anda.
                  </p>
                  <Field label="Password Baru" htmlFor="newPassword">
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-16 text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="Minimal 8 karakter"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <PasswordStrengthMeter score={passwordCheck.score} maxScore={passwordCheck.maxScore} />
                    {passwordCheck.errors.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                        {passwordCheck.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    )}
                  </Field>

                  <Field label="Konfirmasi Password Baru" htmlFor="confirmPassword">
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="Ulangi password baru"
                        autoComplete="new-password"
                      />
                    </div>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setStep(2)
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98] disabled:opacity-70"
                    >
                      <span className="relative">
                        {submitting ? 'Menyimpan...' : 'Simpan Password'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer micro-mark */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Ingat password-nya?{' '}
          <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  )
}

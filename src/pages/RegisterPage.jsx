import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import {
  validateKtp,
  validateUsername,
  validateFullName,
  validatePassword,
  validateDivision,
  validateBirthPlace,
  validateBirthDate,
  validateSex,
  validateAddress,
  formatTtl,
  formatTgl,
  DIVISION_OPTIONS,
} from '../utils/validation'
import {
  scanKtp,
  validateKtpFile,
  readFileAsDataUrl,
  isDiditRealMode,
  normalizeDateOfBirth,
  normalizeSex,
  sexLabel,
} from '../services/diditOcr'

// ============================================================
// Konstanta & helper
// ============================================================

const PRIVACY_TEXT = (
  <>
    <p>
      Dengan mendaftar dan menggunakan layanan HRMS ini, Anda menyatakan telah membaca,
      memahami, dan menyetujui seluruh ketentuan dalam Kebijakan Privasi dan Disclaimer
      berikut.
    </p>
    <h4 className="font-bold text-slate-900">1. Pengumpulan Data Pribadi</h4>
    <p>
      Kami mengumpulkan data pribadi yang Anda berikan secara sukarela saat proses registrasi,
      termasuk namun tidak terbatas pada nama lengkap, nomor KTP, dan informasi kepegawaian
      lainnya, untuk keperluan administrasi sumber daya manusia internal.
    </p>
    <h4 className="font-bold text-slate-900">2. Tujuan Penggunaan Data</h4>
      <p>
        Data Anda akan digunakan solely untuk kepentingan internal perusahaan, termasuk namun
        tidak terbatas pada: administrasi kepegawaian, penggajian, absensi, penjadwalan,
        serta pelaporan kepada instansi terkait sesuai peraturan perundang-undangan yang berlaku.
      </p>
    <h4 className="font-bold text-slate-900">3. Penyimpanan & Keamanan</h4>
    <p>
      Data Anda disimpan dengan langkah-langkah keamanan yang wajar dan hanya dapat diakses
      oleh personel yang berwenang. Kami menerapkan praktik terbaik untuk melindungi data
      dari akses yang tidak sah, perubahan, pengungkapan, atau perusakan.
    </p>
    <h4 className="font-bold text-slate-900">4. Kerahasiaan</h4>
    <p>
      Kami tidak akan menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak
      ketiga tanpa persetujuan Anda, kecuali diwajibkan oleh hukum atau peraturan
      perundang-undangan yang berlaku.
    </p>
    <h4 className="font-bold text-slate-900">5. Hak Pengguna</h4>
    <p>
      Anda berhak untuk mengakses, memperbarui, atau meminta koreksi atas data pribadi Anda.
      Permintaan terkait hak-hak ini dapat diajukan melalui kanal yang tersedia di pengaturan
      aplikasi.
    </p>
    <h4 className="font-bold text-slate-900">6. Disclaimer</h4>
    <p>
      Sistem ini disediakan "sebagaimana adanya" (&ldquo;as is&rdquo;). Pihak pengelola tidak
      bertanggung jawab atas segala kerugian yang timbul akibat penyalahgunaan akun,
      kesalahan input data oleh pengguna, atau gangguan teknis di luar kendali kami.
      Pengguna bertanggung jawab penuh atas kerahasiaan kredensial akun masing-masing.
    </p>
    <h4 className="font-bold text-slate-900">7. Perubahan Kebijakan</h4>
    <p>
      Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Versi terbaru akan selalu
      tersedia di halaman ini dan berlaku sejak tanggal publikasi.
    </p>
    <p className="text-xs text-slate-500">
      Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
  </>
)

// Definisi 4 langkah wizard. Setiap langkah punya: id, label, judul, sub-judul, ikon.
const STEPS = [
  {
    id: 'ktp',
    label: 'Verifikasi KTP',
    title: 'Verifikasi Identitas',
    subtitle: 'Upload foto KTP Anda. Sistem akan membaca data secara otomatis lewat OCR.',
    icon: 'id',
  },
  {
    id: 'data',
    label: 'Data Diri',
    title: 'Konfirmasi Data Diri',
    subtitle: 'Periksa hasil pembacaan KTP, lengkapi tempat lahir & jenis kelamin, lalu pilih divisi.',
    icon: 'user',
  },
  {
    id: 'akun',
    label: 'Akun',
    title: 'Buat Kredensial Akun',
    subtitle: 'Username dan password ini akan Anda pakai untuk masuk ke HRMS.',
    icon: 'key',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Tinjau & Selesaikan',
    subtitle: 'Pastikan semua data sudah benar, setujui kebijakan privasi, lalu kirim.',
    icon: 'check',
  },
]

// ============================================================
// Sub-komponen kecil
// ============================================================

function Field({ label, hint, error, children, htmlFor, optional }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {optional && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-slate-500">
              Opsional
            </span>
          )}
        </span>
        {hint && <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
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
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}

function PrivacyModal({ open, onClose, onAccept }) {
  return (
    <Modal
      open={open}
      title="Kebijakan Privasi & Disclaimer"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            Saya Mengetujui
          </button>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-600">
        {PRIVACY_TEXT}
      </div>
    </Modal>
  )
}

// Stepper (indikator progress di atas wizard)
function Stepper({ steps, currentIndex, onJump }) {
  return (
    <div className="relative">
      {/* garis track */}
      <div className="absolute left-0 right-0 top-3.5 h-px bg-slate-200" aria-hidden="true" />
      <div
        className="absolute left-0 top-3.5 h-px bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 progress-bar-fill"
        style={{
          width: `${(currentIndex / (steps.length - 1)) * 100}%`,
        }}
        aria-hidden="true"
      />
      <ol className="relative flex items-start justify-between">
        {steps.map((s, idx) => {
          const done = idx < currentIndex
          const active = idx === currentIndex
          const clickable = idx < currentIndex // hanya boleh lompat ke langkah yang sudah dilalui
          return (
            <li key={s.id} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onJump(idx)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition',
                  done
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-[0_4px_10px_-2px_rgba(99,102,241,0.5)]'
                    : active
                      ? 'border-indigo-600 bg-white text-indigo-600 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]'
                      : 'border-slate-200 bg-white text-slate-400',
                  clickable ? 'cursor-pointer hover:scale-110' : 'cursor-default',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
                aria-label={`Langkah ${idx + 1}: ${s.label}`}
              >
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </button>
              <span
                className={[
                  'mt-1.5 px-1 text-center text-[10px] font-bold uppercase tracking-wider transition',
                  active ? 'text-indigo-600' : done ? 'text-slate-700' : 'text-slate-400',
                ].join(' ')}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Drop zone untuk upload KTP — mendukung klik & drag-drop.
function KtpDropzone({ onFile, disabled, hint }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={[
        'dropzone relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center',
        dragging ? 'dropzone--active' : '',
        disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      role="button"
      tabIndex={0}
      onDragEnter={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/tiff,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100/70 text-indigo-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2 2 0 002 2h14a2 2 0 002-2v-1.5M16.5 12L12 7.5 7.5 12M12 7.5V21" />
        </svg>
      </div>
      <p className="text-sm font-bold text-slate-800">Klik atau seret foto KTP ke sini</p>
      <p className="mt-1 text-[11px] text-slate-500">JPG, PNG, WEBP, atau PDF · Maks 10 MB</p>
      {hint && <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">{hint}</p>}
    </div>
  )
}

// Tampilkan preview KTP + ringkasan hasil OCR.
function KtpResultCard({ previewUrl, fileName, ocr, onRetake, onUseManual }) {
  return (
    <div className="space-y-4">
      {/* Preview KTP + animasi scan line di mode demo */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <div className="aspect-[16/10] w-full">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Pratinjau KTP"
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              <span className="text-xs">Pratinjau tidak tersedia</span>
            </div>
          )}
        </div>
        {/* Overlay gradient bawah untuk caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate">{fileName || 'KTP terdeteksi'}</span>
            </div>
            <button
              type="button"
              onClick={onRetake}
              className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition hover:bg-white"
            >
              Ganti Foto
            </button>
          </div>
        </div>
        {/* Scan line animasi, hanya saat status = scanning */}
        {ocr?.scanning && (
          <>
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-ocr-scan" />
            <div className="absolute inset-0 bg-emerald-400/5" />
          </>
        )}
      </div>

      {/* Ringkasan field hasil OCR */}
      {ocr?.result && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Data Terbaca {ocr.result.demo ? '(Demo)' : '· Didit.me'}
              </span>
            </div>
            {ocr.result.documentType && (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {String(ocr.result.documentType).replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <OcrField label="NIK" value={ocr.result.nik} mono />
            <OcrField label="Nama Lengkap" value={ocr.result.fullName} />
            <OcrField label="Tempat Lahir" value={ocr.result.placeOfBirth} />
            <OcrField label="Tanggal Lahir" value={ocr.result.dateOfBirth} />
            <OcrField label="Jenis Kelamin" value={sexLabel(ocr.result.sex)} />
            <OcrField label="Alamat" value={ocr.result.address} fullWidth />
          </dl>
          {(ocr.result.warnings?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <span className="font-bold">Catatan:</span> {ocr.result.warnings.join('; ')}
            </div>
          )}
          <p className="mt-3 text-[11px] text-emerald-700">
            Data di bawah ini akan digunakan untuk registrasi dan tidak dapat diubah.
          </p>
        </div>
      )}

      {ocr?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{ocr.error}</span>
        </div>
      )}
    </div>
  )
}

function OcrField({ label, value, mono, fullWidth }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <dt className="ocr-field-label">{label}</dt>
      <dd className={['mt-0.5 text-sm font-semibold text-slate-900', mono ? 'font-mono tracking-wider' : ''].join(' ')}>
        {value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  )
}

// Banner kecil untuk membedakan demo vs real mode.
function OcrModeBanner() {
  const real = isDiditRealMode()
  return (
    <div
      className={[
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed',
        real
          ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
          : 'border-sky-200/80 bg-sky-50/80 text-sky-800',
      ].join(' ')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        {real ? (
          <>
            <strong>Didit.me aktif.</strong> Data KTP Anda diproses oleh layanan OCR Didit untuk
            verifikasi identitas.
          </>
        ) : (
          <>
            <strong>Mode demo.</strong> OCR berjalan lokal dengan data simulasi. Untuk produksi,
            set <code className="rounded bg-white/60 px-1 font-mono text-[10px]">VITE_DIDIT_API_KEY</code>{' '}
            di file <code className="font-mono text-[10px]">.env</code>.
          </>
        )}
      </span>
    </div>
  )
}

// ============================================================
// Halaman utama
// ============================================================

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  // State wizard
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState('forward') // 'forward' | 'back' — untuk animasi

  // State step 1 (KTP / OCR)
  const [ktpFile, setKtpFile] = useState(null)
  const [ktpPreview, setKtpPreview] = useState(null)
  const [ktpNumber, setKtpNumber] = useState('') // NIK 16 digit (dipakai juga untuk simpan)
  const [ocr, setOcr] = useState({ scanning: false, result: null, error: null })
  const ocrAbortRef = useRef(null)

  // State step 2 (data diri)
  const [fullName, setFullName] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('')
  const [address, setAddress] = useState('')
  const [division, setDivision] = useState('')

  // State step 3 (akun)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // State step 4 (review)
  const [agreed, setAgreed] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // State global
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  const passwordCheck = validatePassword(password)

  // Bersihkan URL object setiap kali file berubah agar tidak bocor di memory.
  useEffect(() => {
    return () => {
      if (ktpPreview?.startsWith('blob:')) URL.revokeObjectURL(ktpPreview)
    }
  }, [ktpPreview])

  // ============================================================
  // Handlers step 1
  // ============================================================
  const handleKtpSelected = useCallback(
    async (file) => {
      // batalkan OCR sebelumnya kalau ada
      ocrAbortRef.current?.abort()

      const v = validateKtpFile(file)
      if (!v.ok) {
        setOcr({ scanning: false, result: null, error: v.error })
        return
      }

      // revoke preview lama
      if (ktpPreview?.startsWith('blob:')) URL.revokeObjectURL(ktpPreview)
      const dataUrl = await readFileAsDataUrl(file).catch(() => null)
      setKtpFile(file)
      setKtpPreview(dataUrl)
      setOcr({ scanning: true, result: null, error: null })

      const ctrl = new AbortController()
      ocrAbortRef.current = ctrl
      try {
        const result = await scanKtp(file, { signal: ctrl.signal })
        // Map hasil OCR ke state form
        const normalizedDob = normalizeDateOfBirth(result.dateOfBirth)
        const normalizedSex = normalizeSex(result.sex)
        setKtpNumber(result.nik || '')
        setFullName(result.fullName || '')
        setBirthPlace(result.placeOfBirth || '')
        setBirthDate(normalizedDob || '')
        setSex(normalizedSex || '')
        setAddress(result.address || '')
        setOcr({ scanning: false, result, error: null })
      } catch (err) {
        if (err?.name === 'AbortError') return
        setOcr({ scanning: false, result: null, error: err?.message || 'Gagal membaca KTP.' })
      }
    },
    [ktpPreview],
  )

  const handleRetake = useCallback(() => {
    ocrAbortRef.current?.abort()
    if (ktpPreview?.startsWith('blob:')) URL.revokeObjectURL(ktpPreview)
    setKtpFile(null)
    setKtpPreview(null)
    setKtpNumber('')
    setOcr({ scanning: false, result: null, error: null })
  }, [ktpPreview])

  const handleUseManual = useCallback(() => {
    // tetap pakai file/preview yang sudah di-upload, hanya bersihkan error OCR
    setOcr((o) => ({ ...o, error: null }))
  }, [])

  // ============================================================
  // Validasi per langkah
  // ============================================================
  const validateStep1 = () => {
    const e = {}
    if (!ktpFile) e.ktpFile = 'Silakan upload foto KTP terlebih dahulu.'
    if (!ktpNumber) e.ktpFile = 'Nomor KTP belum terbaca. Pastikan foto jelas atau input manual.'
    else {
      const k = validateKtp(ktpNumber)
      if (!k.isValid) e.ktpFile = k.error
    }
    return e
  }

  const validateStep2 = () => {
    // Step 2 = konfirmasi data diri (read-only dari OCR) + pilih divisi.
    // Field OCR sudah dijamin valid di Step 1 (validateStep1), jadi di sini
    // cukup pastikan state OCR-derived masih terisi dan divisi dipilih.
    const e = {}
    if (!ktpNumber) e.ktpNumber = 'Nomor KTP belum terbaca. Kembali ke langkah sebelumnya.'
    if (!fullName?.trim()) e.fullName = 'Nama lengkap belum terbaca. Kembali ke langkah sebelumnya.'
    if (!birthPlace?.trim()) e.birthPlace = 'Tempat lahir belum terbaca. Kembali ke langkah sebelumnya.'
    if (!birthDate) e.birthDate = 'Tanggal lahir belum terbaca. Kembali ke langkah sebelumnya.'
    if (!sex) e.sex = 'Jenis kelamin belum terbaca. Kembali ke langkah sebelumnya.'
    if (!address?.trim()) e.address = 'Alamat belum terbaca. Kembali ke langkah sebelumnya.'
    const divCheck = validateDivision(division)
    if (!divCheck.isValid) e.division = divCheck.error
    return e
  }

  const validateStep3 = () => {
    const e = {}
    const userCheck = validateUsername(username)
    if (!userCheck.isValid) e.username = userCheck.error
    if (!passwordCheck.isStrong) e.password = 'Password belum memenuhi syarat kekuatan.'
    if (password !== confirmPassword) e.confirmPassword = 'Konfirmasi password tidak cocok.'
    return e
  }

  const validateStep4 = () => {
    const e = {}
    if (!agreed) e.agreed = 'Anda harus menyetujui kebijakan privasi & disclaimer.'
    return e
  }

  // ============================================================
  // Navigasi wizard
  // ============================================================
  const goNext = () => {
    const validator = [validateStep1, validateStep2, validateStep3, validateStep4][step]
    const e = validator()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setDirection('forward')
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    // scroll ke atas setiap pindah langkah supaya user lihat judul baru
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setErrors({})
    setDirection('back')
    setStep((s) => Math.max(s - 1, 0))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goTo = (idx) => {
    if (idx === step || idx > step) return
    setErrors({})
    setDirection(idx > step ? 'forward' : 'back')
    setStep(idx)
  }

  // ============================================================
  // Submit final
  // ============================================================
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const e4 = validateStep4()
    if (Object.keys(e4).length > 0) {
      setErrors(e4)
      return
    }
    setSubmitting(true)
    try {
      const result = await register({
        fullName,
        ktp: ktpNumber,
        username,
        password,
        division,
        birthPlace,
        birthDate,
        sex,
        address,
        ktpVerified: Boolean(ocr.result) && (ocr.result.status || '').toLowerCase() === 'approved',
      })
      if (!result.ok) {
        // kembali ke step akun agar user lihat error username
        setStep(2)
        setErrors({ username: result.error })
        return
      }
      setSuccess(result.user)
      setTimeout(() => navigate('/login'), 1800)
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // Render
  // ============================================================

  const currentStep = STEPS[step]
  const stepEnterClass = direction === 'back' ? 'animate-step-enter-back' : 'animate-step-enter'

  return (
    <div className="relative mx-auto flex min-h-full max-w-mobile flex-col overflow-hidden bg-white px-5 py-6">
      {/* Background — sama dengan login untuk konsistensi */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
      <div
        className="animate-blob-a pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-200/45 via-pink-200/30 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-blob-b pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/45 via-violet-200/30 to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative mb-5 flex items-center gap-3 animate-fade-in">
        <Link
          to="/login"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 backdrop-blur-sm transition hover:bg-white active:scale-95"
          aria-label="Kembali"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[28%_72%_70%_30%/30%_30%_70%_70%] bg-indigo-600 text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,0.55)]">
            <span className="font-display text-sm italic font-bold leading-none">P</span>
          </span>
          <div>
            <h1 className="font-display text-base font-bold leading-tight text-slate-900">
              <span className="italic">Prasasti</span>{' '}
              <span className="text-indigo-600">Group</span>
              <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">HRMS</span>
            </h1>
            <p className="text-[11px] text-slate-500">Registrasi Akun Baru</p>
          </div>
        </div>
      </div>

      {/* Success state */}
      {success ? (
        <div className="card flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Registrasi Berhasil</h3>
          <p className="mt-2 text-sm text-slate-600">Akun Anda telah dibuat.</p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Catatan</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              NIK (Nomor Induk Karyawan) akan diinputkan oleh admin. Anda sudah bisa login sekarang.
            </p>
          </div>
          <p className="mt-4 text-xs text-slate-500">Mengalihkan ke halaman login...</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-5 sm:p-6 animate-slide-up">
          {/* Stepper */}
          <div className="mb-5">
            <Stepper steps={STEPS} currentIndex={step} onJump={goTo} />
          </div>

          {/* Judul langkah */}
          <div className={`mb-4 ${stepEnterClass}`} key={`title-${step}`}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-600">
                <StepIcon name={currentStep.icon} />
              </span>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
                {currentStep.title}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{currentStep.subtitle}</p>
          </div>

          {/* Isi langkah */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (step === STEPS.length - 1) handleSubmit()
              else goNext()
            }}
            className={`${stepEnterClass} min-h-[280px]`}
            key={`body-${step}`}
          >
            {step === 0 && (
              <StepKtp
                ktpFile={ktpFile}
                ktpPreview={ktpPreview}
                ocr={ocr}
                onFile={handleKtpSelected}
                onRetake={handleRetake}
                error={errors.ktpFile}
                scanning={ocr.scanning}
              />
            )}

            {step === 1 && (
              <StepData
                fullName={fullName}
                birthPlace={birthPlace}
                birthDate={birthDate}
                sex={sex}
                address={address}
                division={division}
                setDivision={setDivision}
                ktpNumber={ktpNumber}
                errors={errors}
                ocrResult={ocr.result}
              />
            )}

            {step === 2 && (
              <StepAkun
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                passwordCheck={passwordCheck}
                errors={errors}
              />
            )}

            {step === 3 && (
              <StepReview
                fullName={fullName}
                ktpNumber={ktpNumber}
                birthPlace={birthPlace}
                birthDate={birthDate}
                sex={sex}
                address={address}
                division={division}
                username={username}
                agreed={agreed}
                setAgreed={setAgreed}
                onOpenPrivacy={() => setPrivacyOpen(true)}
                error={errors.agreed}
                ocrResult={ocr.result}
              />
            )}

            {/* Navigasi */}
            <div className="mt-6 flex items-center gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Kembali
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Batal
                </Link>
              )}

              <button
                type={step === STEPS.length - 1 ? 'submit' : 'button'}
                onClick={(e) => {
                  if (step !== STEPS.length - 1) {
                    e.preventDefault()
                    goNext()
                  }
                }}
                disabled={submitting || ocr.scanning}
                className="relative flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Membuat Akun...
                  </>
                ) : step === STEPS.length - 1 ? (
                  <>
                    Kirim Pendaftaran
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Lanjut
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {step === 0 && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Sudah punya akun?{' '}
                <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700">
                  Masuk di sini
                </Link>
              </p>
            )}
          </form>
        </div>
      )}

      <PrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        onAccept={() => {
          setAgreed(true)
          setPrivacyOpen(false)
        }}
      />
    </div>
  )
}

// ============================================================
// Ikon kecil untuk header tiap langkah
// ============================================================
function StepIcon({ name }) {
  const cls = 'h-4 w-4'
  switch (name) {
    case 'id':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm5 6a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      )
    case 'user':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'key':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'check':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )
    default:
      return null
  }
}

// ============================================================
// Komponen per-langkah (di-mount terpisah biar form tetap ringan)
// ============================================================

function StepKtp({
  ktpFile,
  ktpPreview,
  ktpNumber,
  setKtpNumber,
  ocr,
  onFile,
  onRetake,
  onUseManual,
  error,
  scanning,
}) {
  const showResult = ktpFile && (ocr.scanning || ocr.result || ocr.error)
  return (
    <div className="space-y-4">
      <OcrModeBanner />

      {!showResult ? (
        <>
          <KtpDropzone onFile={onFile} hint="Pastikan foto jelas, tidak buram, dan semua sudut terlihat." />
          <p className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700">
            <span className="font-bold">Perhatian:</span> Nomor KTP hanya dapat dibaca otomatis lewat OCR.
            Pastikan foto KTP terlihat jelas dan seluruh sudut dokumen masuk dalam frame.
          </p>
        </>
      ) : (
        <KtpResultCard
          previewUrl={ktpPreview}
          fileName={ktpFile?.name}
          ocr={{ ...ocr, scanning: ocr.scanning || scanning }}
          onRetake={onRetake}
          onUseManual={onUseManual}
        />
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

function StepData({
  fullName,
  birthPlace,
  birthDate,
  sex,
  address,
  division,
  setDivision,
  ktpNumber,
  errors,
  ocrResult,
}) {
  const filledFromOcr = Boolean(ocrResult)

  // Baris read-only: label kecil + value terkunci. Dipakai untuk semua data dari OCR.
  const ReadOnlyRow = ({ label, value, mono = false, fullWidth = false }) => (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {label}
      </p>
      <div
        className={[
          'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800',
          mono ? 'font-mono tracking-wider' : '',
        ].join(' ')}
      >
        {value || <span className="font-normal text-slate-400">—</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Banner penjelasan: data dari OCR & terkunci */}
      <div className="flex items-start gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-indigo-800">
        <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>
          Data di bawah ini{' '}
          <span className="font-bold">diambil otomatis dari hasil OCR KTP</span>{' '}
          dan <span className="font-bold">tidak dapat diubah</span> pada langkah ini. Data akan
          tersimpan ke profil Anda setelah registrasi selesai.
          {filledFromOcr ? null : (
            <>
              {' '}
              <span className="text-amber-700">
                Jika ada yang tidak sesuai, kembali ke langkah sebelumnya dan upload ulang foto KTP.
              </span>
            </>
          )}
        </span>
      </div>

      {/* Bagian Data Pribadi (read-only) */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Data Pribadi (dari KTP)
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <ReadOnlyRow label="NIK (Nomor KTP)" value={ktpNumber} mono />
          <ReadOnlyRow label="Nama Lengkap" value={fullName} />
          <ReadOnlyRow label="Tempat Lahir" value={birthPlace} />
          <ReadOnlyRow label="Tanggal Lahir" value={formatTgl(birthDate)} />
          <ReadOnlyRow label="Jenis Kelamin" value={sexLabel(sex)} />
          <ReadOnlyRow label="Alamat" value={address} fullWidth />
        </div>
      </section>

      {/* Bagian Informasi Kepegawaian (editable: divisi) */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </span>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Informasi Kepegawaian
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Field label="Divisi" htmlFor="division" error={errors.division}>
            <div className="relative">
              <select
                id="division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="">Pilih divisi...</option>
                {DIVISION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </Field>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            Divisi digunakan untuk pengajuan & penjadwalan. NIK (Nomor Induk Karyawan) akan
            diinputkan oleh admin setelah akun Anda terdaftar.
          </p>
        </div>
      </section>
    </div>
  )
}

function StepAkun({
  username,
  setUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  passwordCheck,
  errors,
}) {
  return (
    <div className="space-y-4">
      <Field label="Username" htmlFor="username" error={errors.username}>
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
            onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="username unik untuk login"
            autoComplete="username"
          />
        </div>
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password}>
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
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-14 text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-[11px] font-bold text-slate-500 hover:text-slate-700"
            aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
          >
            {showPassword ? 'Sembunyi' : 'Lihat'}
          </button>
        </div>
        <PasswordStrengthMeter score={passwordCheck.score} maxScore={passwordCheck.maxScore} />
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
          {passwordCheck.errors.length === 0 ? (
            <li className="text-emerald-600">✓ Password sudah kuat.</li>
          ) : (
            passwordCheck.errors.map((err, i) => <li key={i}>• {err}</li>)
          )}
        </ul>
      </Field>

      <Field label="Konfirmasi Password" htmlFor="confirmPassword" error={errors.confirmPassword}>
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
            placeholder="Ulangi password"
            autoComplete="new-password"
          />
        </div>
      </Field>
    </div>
  )
}

function StepReview({
  fullName,
  ktpNumber,
  birthPlace,
  birthDate,
  sex,
  address,
  division,
  username,
  agreed,
  setAgreed,
  onOpenPrivacy,
  error,
  ocrResult,
}) {
  const rows = useMemo(
    () => [
      { label: 'Nama Lengkap', value: fullName },
      { label: 'NIK', value: ktpNumber, mono: true },
      { label: 'Tempat, Tgl Lahir', value: formatTtl(birthPlace, birthDate) },
      { label: 'Jenis Kelamin', value: sexLabel(sex) },
      { label: 'Alamat', value: address || '—' },
      { label: 'Divisi', value: division },
      { label: 'Username', value: username, mono: true },
    ],
    [fullName, ktpNumber, birthPlace, birthDate, sex, address, division, username],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="ocr-field-label">Ringkasan Pendaftaran</p>
          {ocrResult && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              KTP {ocrResult.demo ? 'Demo' : 'Terverifikasi'}
            </span>
          )}
        </div>
        <dl className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-2 last:border-0 last:pb-0">
              <dt className="text-[11px] font-semibold text-slate-500">{r.label}</dt>
              <dd
                className={[
                  'max-w-[60%] text-right text-sm font-semibold text-slate-900',
                  r.mono ? 'font-mono tracking-wider' : '',
                ].join(' ')}
              >
                {r.value || <span className="text-slate-400">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-4 focus:ring-indigo-500/20"
          />
          <span className="text-xs leading-relaxed text-slate-700">
            Saya menyetujui{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onOpenPrivacy()
              }}
              className="font-bold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
            >
              Kebijakan Privasi &amp; Disclaimer
            </button>{' '}
            yang berlaku pada sistem HRMS ini.
          </span>
        </label>
        {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  )
}

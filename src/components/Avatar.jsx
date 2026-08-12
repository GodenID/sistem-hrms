import React from 'react'

// Pemetaan avatarColor → kelas Tailwind gradient. Dipakai sebagai fallback
// saat user belum mengupload foto profil. Sumber kebenaran tunggal dipakai
// oleh semua halaman (DirectoryPage, AdminPage, SettingsPage, dll).
export const AVATAR_GRADIENTS = {
  indigo: 'from-indigo-500 to-indigo-600',
  fuchsia: 'from-fuchsia-500 to-fuchsia-600',
  sky: 'from-sky-500 to-sky-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-amber-600',
  rose: 'from-rose-500 to-rose-600',
  violet: 'from-violet-500 to-violet-600',
  cyan: 'from-cyan-500 to-cyan-600',
}

const SIZE_CLASSES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-3xl',
}

// Ubah teks nama → inisial 1-2 huruf. Fallback '?' untuk nama kosong.
function getInitials(name) {
  const cleaned = String(name || '').trim()
  if (!cleaned) return '?'
  return (
    cleaned
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  )
}

/**
 * Avatar universal HRMS.
 *
 * Props:
 *  - name (string): nama user (untuk inisial fallback)
 *  - color (string): kunci warna di AVATAR_GRADIENTS (untuk fallback gradient)
 *  - photo (string|null): data URL foto profil. Jika ada, render gambar.
 *  - size ('xs'|'sm'|'md'|'lg'|'xl'|'2xl'): ukuran avatar. Default 'md'.
 *  - ring (boolean): tambahkan ring putih di sekeliling (untuk current user dsb).
 *  - editable (boolean): tampilkan overlay kamera + efek hover (untuk halaman profil).
 *  - onClick (fn): handler klik (untuk memicu upload).
 */
export default function Avatar({
  name,
  color,
  photo,
  size = 'md',
  ring = false,
  editable = false,
  onClick,
  className = '',
  alt,
}) {
  const initials = getInitials(name)
  const grad = AVATAR_GRADIENTS[color] || AVATAR_GRADIENTS.indigo
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md

  const clickable = Boolean(onClick)

  return (
    <div
      className={[
        'group relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full',
        sizeCls,
        ring ? 'ring-[3px] ring-white shadow-[0_4px_14px_-2px_rgba(15,23,42,0.18)]' : 'shadow-sm',
        clickable ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      {/* Layer 1: gradient + inisial (selalu di belakang sebagai fallback) */}
      <div
        aria-hidden={Boolean(photo)}
        className={[
          'absolute inset-0 flex items-center justify-center bg-gradient-to-br font-extrabold text-white',
          grad,
          photo ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {initials}
      </div>

      {/* Layer 2: foto (kalau ada) */}
      {photo ? (
        <img
          src={photo}
          alt={alt || name || 'Foto profil'}
          className="relative h-full w-full object-cover"
          draggable={false}
        />
      ) : null}

      {/* Layer 3: overlay edit (kamera + hover) untuk mode editable */}
      {editable ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-full bg-slate-900/0 transition-colors duration-200 group-hover:bg-slate-900/40" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-1/2 w-1/2 drop-shadow"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7h3l2-2h8l2 2h3a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16a4 4 0 100-8 4 4 0 000 8z"
              />
            </svg>
          </div>
          {/* Badge kamera kecil di pojok kanan-bawah (selalu tampil di mode editable) */}
          <div className="absolute -bottom-0.5 -right-0.5 flex h-1/3 min-h-[18px] w-1/3 min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-2/3 w-2/3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        </>
      ) : null}
    </div>
  )
}

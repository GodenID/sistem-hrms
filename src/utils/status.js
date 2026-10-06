// Design token — warna status konsisten di seluruh HRMS
// Satu sumber kebenaran, jangan hardcode string warna di komponen.

export const STATUS = {
  hadir: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Hadir' },
  belum: { bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-200', ring: 'ring-1 ring-slate-300', label: 'Belum Absen' },
  libur: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Libur' },
  cuti: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Cuti' },
  pengajuan: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', label: 'Pengajuan' },
  sakit: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', label: 'Sakit' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Menunggu' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Disetujui' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', label: 'Ditolak' },
}

export function statusStyle(key) {
  return STATUS[key] || STATUS.belum
}

// Helper untuk kalender: map leave/status ke token
export function calendarStatus({ isHoliday, isWeekend, leave, attended }) {
  if (isHoliday || isWeekend) return STATUS.libur
  if (leave?.type === 'cuti' && leave.status === 'approved') return STATUS.cuti
  if (leave && (leave.type === 'cuti' || leave.type === 'sakit') && leave.status === 'pending') return STATUS.pengajuan
  if (leave?.type === 'sakit' && leave.status === 'approved') return STATUS.sakit
  if (attended) return STATUS.hadir
  return STATUS.belum
}

import * as XLSX from 'xlsx-js-style'

// ============================================================
// Style definitions — modern, clean look
// ============================================================
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FF4F46E5' } }, // indigo-600
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
  },
}

const DATA_STYLE = {
  font: { sz: 10, name: 'Calibri', color: { rgb: 'FF0F172A' } }, // slate-900
  alignment: { vertical: 'center' },
  border: {
    bottom: { style: 'thin', color: { rgb: 'FFF1F5F9' } },
    left: { style: 'thin', color: { rgb: 'FFF1F5F9' } },
    right: { style: 'thin', color: { rgb: 'FFF1F5F9' } },
  },
}

const STRIPE_STYLE = {
  ...DATA_STYLE,
  fill: { fgColor: { rgb: 'FFFAFBFC' } }, // slate-50
}

// Status → fill color (modern pastel)
const STATUS_FILLS = {
  Hadir: 'FFD1FAE5',         // emerald-100
  Cuti: 'FFE0F2FE',          // sky-100
  Sakit: 'FFFFE4E6',         // rose-100
  Lembur: 'FFFEF3C7',        // amber-100
  Koreksi: 'FFE0F2FE',       // sky-100
  Lainnya: 'FFF1F5F9',       // slate-100
  Libur: 'FFFEE2E2',         // red-100
  'Tidak Hadir': 'FFF1F5F9', // slate-100
  'Akan Datang': 'FFFEF3C7', // amber-100
}

const STATUS_FONT_COLORS = {
  Hadir: 'FF065F46',         // emerald-800
  Cuti: 'FF075985',          // sky-800
  Sakit: 'FF9F1239',         // rose-800
  Lembur: 'FF92400E',        // amber-700
  Koreksi: 'FF075985',       // sky-800
  Lainnya: 'FF475569',       // slate-600
  Libur: 'FF991B1B',         // red-800
  'Tidak Hadir': 'FF475569', // slate-600
  'Akan Datang': 'FF92400E', // amber-700
}

const MONTH_NAMES_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseTime(s) {
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2}):(\d{2})/.exec(s.replace(' WIB', ''))
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function computeDurationStr(clockIn, clockOut) {
  const inSec = parseTime(clockIn)
  const outSec = parseTime(clockOut)
  if (inSec === null || outSec === null || outSec <= inSec) return ''
  const diff = outSec - inSec
  const hh = Math.floor(diff / 3600)
  const mm = Math.floor((diff % 3600) / 60)
  return `${hh} jam ${mm} menit`
}

function applyStyleRange(ws, range, style) {
  const decoded = XLSX.utils.decode_range(range)
  for (let r = decoded.s.r; r <= decoded.e.r; r += 1) {
    for (let c = decoded.s.c; c <= decoded.e.c; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { v: '' }
      ws[ref].s = style
    }
  }
}

function colLetter(c) {
  // 0=A, 1=B, ... 25=Z, 26=AA
  let s = ''
  let n = c
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

// ============================================================
// EXPORT: Rekap Absensi (per user per hari, per bulan)
// ============================================================
export function exportAbsensiToExcel({ users, history, pengajuan, holidays = [], month, year }) {
  const headers = ['Nama Lengkap', 'Username', 'NIK', 'Divisi', 'Tanggal', 'Clock In', 'Clock Out', 'Durasi', 'Status', 'Jam Lembur']
  const colWidths = [
    { wch: 25 }, // Nama
    { wch: 15 }, // Username
    { wch: 14 }, // NIK
    { wch: 15 }, // Divisi
    { wch: 12 }, // Tanggal
    { wch: 11 }, // Clock In
    { wch: 11 }, // Clock Out
    { wch: 14 }, // Durasi
    { wch: 13 }, // Status
    { wch: 18 }, // Jam Lembur
  ]

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const lastDay = new Date(year, month, 0).getDate()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month - 1, lastDay, 23, 59, 59, 999)

  // Index untuk O(1) lookup — fix #1 O(n*m)
  const historyMap = new Map()
  for (const h of history || []) historyMap.set(`${h.userId}_${h.date}`, h)
  const holidaySet = new Set((holidays || []).map((h) => h.date))
  // Index pengajuan approved per user per tanggal (untuk status Cuti/Sakit)
  const leaveMap = new Map()
  for (const p of pengajuan || []) {
    if (p.status !== 'approved') continue
    const s = new Date(p.startDate + 'T00:00:00')
    const e = new Date(p.endDate + 'T00:00:00')
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const k = `${p.userId}_${d.toISOString().slice(0, 10)}`
      if (!leaveMap.has(k)) leaveMap.set(k, p)
    }
  }

  const aoa = [headers]

  users.forEach((u) => {
    const cursor = new Date(start)
    while (cursor.getTime() <= end.getTime()) {
      const date = new Date(cursor)
      const dateStr = date.toISOString().slice(0, 10)
      const rec = historyMap.get(`${u.id}_${dateStr}`)
      let clockIn = ''
      let clockOut = ''
      let status = 'Tidak Hadir'
      let jamLembur = ''
      const leave = leaveMap.get(`${u.id}_${dateStr}`)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      const isHoliday = holidaySet.has(dateStr)
      if (rec?.clockIn || rec?.clockOut) {
        clockIn = (rec.clockIn || '').replace(' WIB', '')
        clockOut = (rec.clockOut || '').replace(' WIB', '')
        status = 'Hadir'
      } else if (leave) {
        const map = { cuti: 'Cuti', sakit: 'Sakit', lembur: 'Lembur', koreksi: 'Koreksi', lainnya: 'Lainnya' }
        status = map[leave.type] || 'Izin'
        if (leave.type === 'lembur' && leave.clockInTime) {
          jamLembur = `${leave.clockInTime} – ${leave.clockOutTime}`
        }
      } else if (isWeekend || isHoliday) {
        status = 'Libur'
      } else if (dateStr > todayStr) {
        status = 'Akan Datang'
      }
      aoa.push([
        u.fullName || u.username || '',
        u.username || '',
        u.nik || '-',
        u.division || '-',
        dateStr,
        clockIn,
        clockOut,
        computeDurationStr(rec?.clockIn, rec?.clockOut),
        status,
        jamLembur,
      ])
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colWidths

  // Header row styling
  const lastCol = headers.length - 1
  const lastRow = aoa.length - 1
  const headerEndRef = XLSX.utils.encode_cell({ r: 0, c: lastCol })
  applyStyleRange(ws, `A1:${headerEndRef}`, HEADER_STYLE)
  ws['!rows'] = [{ hpt: 28 }] // header height

  // Data row styling — alternating stripes + status colors
  for (let r = 1; r <= lastRow; r += 1) {
    const isStripe = r % 2 === 0
    for (let c = 0; c <= lastCol; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      const cellValue = aoa[r][c]
      let cellStyle = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
      // Status column (index 8) gets colored fill + bold
      if (c === 8 && STATUS_FILLS[cellValue]) {
        cellStyle = {
          ...cellStyle,
          fill: { fgColor: { rgb: STATUS_FILLS[cellValue] } },
          font: {
            ...cellStyle.font,
            bold: true,
            color: { rgb: STATUS_FONT_COLORS[cellValue] || cellStyle.font.color },
          },
          alignment: { ...cellStyle.alignment, horizontal: 'center' },
        }
      }
      // Center-align Date, Status, and Jam Lembur columns
      if (c === 4 || c === 8 || c === 9) {
        cellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } }
      }
      ws[ref].s = cellStyle
    }
  }

  // Freeze first row
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // Auto-filter on header row
  ws['!autofilter'] = { ref: `A1:${colLetter(lastCol)}${lastRow + 1}` }

  const wb = XLSX.utils.book_new()

  // Sheet name: "1 – 31 Agu 2026"
  const sheetName = `1 – ${lastDay} ${MONTH_NAMES_SHORT[month - 1]} ${year}`
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31))
  const filename = `rekap-absensi-${pad2(month)}-${year}.xlsx`
  XLSX.writeFile(wb, filename)
}

// ============================================================
// EXPORT: Event per Bulan (dengan voucher count)
// ============================================================
export function exportEventsToExcel({ events, vouchers, month, year }) {
  const headers = ['Nama Event', 'Tanggal', 'Lokasi', 'Status', 'Nilai PO', 'Kategori PO', 'Total Biaya', 'Manpower', 'Sebagai']
  const colWidths = [
    { wch: 30 }, // Nama Event
    { wch: 16 }, // Tanggal
    { wch: 28 }, // Lokasi
    { wch: 12 }, // Status
    { wch: 18 }, // Nilai PO
    { wch: 16 }, // Kategori PO
    { wch: 18 }, // Total Biaya
    { wch: 30 }, // Manpower
    { wch: 28 }, // Sebagai
  ]

  const monthPrefix = `${year}-${pad2(month)}`
  const filtered = events.filter((e) => {
    const d = e.startDate || e.date
    return d && d.startsWith(monthPrefix)
  })

  const CATEGORY_LABEL = { kecil: 'Event Kecil', menengah: 'Event Menengah', besar: 'Event Besar' }
  const CATEGORY_FILLS = {
    kecil: { fgColor: { rgb: 'FFD1FAE5' } },
    menengah: { fgColor: { rgb: 'FFFEF3C7' } },
    besar: { fgColor: { rgb: 'FFFFE4E6' } },
  }
  const CATEGORY_FONTS = {
    kecil: { color: { rgb: 'FF065F46' }, bold: true },
    menengah: { color: { rgb: 'FF92400E' }, bold: true },
    besar: { color: { rgb: 'FF9F1239' }, bold: true },
  }

  const STATUS_FILLS_EVENT = {
    pending: { fgColor: { rgb: 'FFFEF3C7' } },
    approved: { fgColor: { rgb: 'FFD1FAE5' } },
    rejected: { fgColor: { rgb: 'FFFFE4E6' } },
  }
  const STATUS_FONTS_EVENT = {
    pending: { color: { rgb: 'FF92400E' }, bold: true },
    approved: { color: { rgb: 'FF065F46' }, bold: true },
    rejected: { color: { rgb: 'FF9F1239' }, bold: true },
  }

  function formatDateRange(start, end) {
    if (!start) return '-'
    const fmt = (d) => {
      const dt = new Date(d + 'T00:00:00')
      return `${dt.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][dt.getMonth()]} ${dt.getFullYear()}`
    }
    const s = fmt(start)
    if (!end || start === end) return s
    return `${s} — ${fmt(end)}`
  }

  function fmtRupiah(amount) {
    if (!amount || amount <= 0) return ''
    return 'Rp ' + Number(amount).toLocaleString('id-ID')
  }

  const aoa = [headers]
  filtered.forEach((e) => {
    const manpower = e.manpower || []
    const additionalTotal = (e.additionalCosts || []).reduce((s, c) => s + (c.amount || 0), 0)
    const totalBiaya = (e.poAmount || 0) + additionalTotal

    if (manpower.length === 0) {
      aoa.push([
        e.name || '',
        formatDateRange(e.startDate || e.date, e.endDate),
        e.location || '',
        e.status || 'approved',
        fmtRupiah(e.poAmount),
        CATEGORY_LABEL[e.poCategory] || '-',
        totalBiaya > 0 ? fmtRupiah(totalBiaya) : '',
        '-',
        '-',
      ])
    } else {
      manpower.forEach((m, i) => {
        aoa.push([
          i === 0 ? e.name || '' : '',
          i === 0 ? formatDateRange(e.startDate || e.date, e.endDate) : '',
          i === 0 ? e.location || '' : '',
          i === 0 ? e.status || 'approved' : '',
          i === 0 ? fmtRupiah(e.poAmount) : '',
          i === 0 ? CATEGORY_LABEL[e.poCategory] || '-' : '',
          i === 0 ? (totalBiaya > 0 ? fmtRupiah(totalBiaya) : '') : '',
          m.name || '',
          Array.isArray(m.roles) ? m.roles.join(', ') : m.role || '',
        ])
      })
    }
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colWidths

  const lastCol = headers.length - 1
  const lastRow = aoa.length - 1

  // Header style
  const headerEndRef = XLSX.utils.encode_cell({ r: 0, c: lastCol })
  applyStyleRange(ws, `A1:${headerEndRef}`, HEADER_STYLE)
  ws['!rows'] = [{ hpt: 30 }]

  // Data rows
  for (let r = 1; r <= lastRow; r += 1) {
    const isStripe = r % 2 === 0
    const lineCount = filtered[r - 1]?.manpower?.length || 1
    ws['!rows'][r] = { hpt: Math.max(24, lineCount * 18) }

    for (let c = 0; c <= lastCol; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      let cellStyle = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }

      // Wrap & top-align manpower columns
      if (c === 7 || c === 8) {
        cellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, wrapText: true, vertical: 'top' } }
      }

      // Status column colors
      if (c === 3 && ws[ref].v) {
        const val = String(ws[ref].v).toLowerCase()
        cellStyle = {
          ...cellStyle,
          fill: STATUS_FILLS_EVENT[val] || cellStyle.fill,
          font: { ...cellStyle.font, ...(STATUS_FONTS_EVENT[val] || {}) },
          alignment: { ...cellStyle.alignment, horizontal: 'center' },
        }
      }

      // Category column colors
      if (c === 5 && ws[ref].v) {
        const catKey = Object.keys(CATEGORY_LABEL).find((k) => CATEGORY_LABEL[k] === ws[ref].v)
        if (catKey) {
          cellStyle = {
            ...cellStyle,
            fill: CATEGORY_FILLS[catKey] || cellStyle.fill,
            font: { ...cellStyle.font, ...(CATEGORY_FONTS[catKey] || {}) },
            alignment: { ...cellStyle.alignment, horizontal: 'center' },
          }
        }
      }

      // PO Amount & Biaya: right-align
      if (c === 4 || c === 6) {
        cellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'right' } }
      }

      ws[ref].s = cellStyle
    }
  }

  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  ws['!autofilter'] = { ref: `A1:${colLetter(lastCol)}${lastRow + 1}` }

  const sheetName = `Event ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][month - 1]} ${year}`
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31))

  const filename = `event-${year}-${pad2(month)}.xlsx`
  XLSX.writeFile(wb, filename)
}

// ============================================================
// EXPORT: OKR Report (filtered inputs)
// ============================================================
export function exportOkrToExcel({ inputs, from, to }) {
  const headers = ['Tanggal', 'Nama', 'Username', 'Job', 'Kategori', 'Judul', 'Deskripsi']
  const colWidths = [{ wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 35 }]
  const aoa = [headers]
  for (const r of inputs || []) {
    aoa.push([
      (r.workDate || '').slice(0, 10),
      r.fullName || r.username || '',
      r.username || '',
      r.jobLabel || '-',
      r.category === 'utama' ? 'Utama' : 'Lainnya',
      r.title || '',
      (r.description || '').slice(0, 200),
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colWidths
  const lastCol = headers.length - 1
  const lastRow = aoa.length - 1
  const headerEndRef = XLSX.utils.encode_cell({ r: 0, c: lastCol })
  applyStyleRange(ws, `A1:${headerEndRef}`, HEADER_STYLE)
  ws['!rows'] = [{ hpt: 24 }]
  for (let r = 1; r <= lastRow; r++) {
    const isStripe = r % 2 === 0
    for (let c = 0; c <= lastCol; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      let style = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
      if (c === 4) style = { ...style, alignment: { ...style.alignment, horizontal: 'center' } }
      ws[ref].s = style
    }
  }
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  ws['!autofilter'] = { ref: `A1:${colLetter(lastCol)}${lastRow + 1}` }
  const wb = XLSX.utils.book_new()
  const sheetName = `OKR ${from} sd ${to}`.substring(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `okr-${from}_sd_${to}.xlsx`)
}

// ============================================================
// EXPORT GLOBAL — 1 klik semua (karyawan + absensi 26-25 matrix + cuti + OKR)
// Periode tutup buku 25, buka 26 → 25 bulan berikutnya
// - Matrix: 1 baris per orang, kolom per tanggal (26–25), libur merah
// - Tidak ribet: ringkas, auto-filter, freeze, total rekap
// ============================================================
export function exportGlobalToExcel({ users, history, pengajuan, okrInputs, month, year, holidays = [], events = [] }) {
  const wb = XLSX.utils.book_new()

  // Helper periode 26–25
  const periodMonth = Number(month)
  const periodYear = Number(year)
  let sM = periodMonth - 1
  let sY = periodYear
  if (sM === 0) { sM = 12; sY -= 1 }
  const start = new Date(sY, sM - 1, 26)
  const end = new Date(periodYear, periodMonth - 1, 25, 23, 59, 59, 999)
  const dates = []
  const cur = new Date(start)
  while (cur.getTime() <= end.getTime()) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  const todayStr = new Date().toISOString().slice(0, 10)
  const periodLabel = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]} ${end.getFullYear()}`
  const sheetNameAbsensi = `Absensi ${start.getDate()}${MONTH_NAMES_SHORT[start.getMonth()]}-${end.getDate()}${MONTH_NAMES_SHORT[end.getMonth()]}${end.getFullYear()}`.substring(0, 31)
  const fileSuffix = `${periodYear}-${pad2(periodMonth)}_26-${start.getDate()}${MONTH_NAMES_SHORT[start.getMonth()]}_25-${MONTH_NAMES_SHORT[end.getMonth()]}`

  // Sheet 1: Karyawan (superadmin ditampilkan sebagai admin)
  {
    const headers = ['Nama', 'Username', 'NIK', 'Divisi', 'Role', 'Bergabung']
    const aoa = [headers]
    for (const u of users || []) {
      const roleLabel = u.role === 'superadmin' ? 'admin' : (u.role || '-')
      aoa.push([u.fullName || '', u.username || '', u.nik || '-', u.division || '-', roleLabel, (u.createdAt || '').slice(0, 10)])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
    applyStyleRange(ws, `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}`, HEADER_STYLE)
    ws['!rows'] = [{ hpt: 24 }]
    for (let r = 1; r < aoa.length; r++) {
      const isStripe = r % 2 === 0
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        ws[ref].s = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
      }
    }
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    ws['!autofilter'] = { ref: `A1:${colLetter(headers.length - 1)}${aoa.length}` }
    XLSX.utils.book_append_sheet(wb, ws, 'Karyawan')
  }

  // Sheet 2: Absensi Matrix 26–25 (tracking ga ribet, libur merah aja)
  {
    const dateHeaders = dates.map((d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`)
    const baseHeaders = ['No', 'Nama', 'NIK', 'Divisi']
    const totalHeaders = ['Hadir', 'Libur', 'TK', 'Cuti', 'Sakit']
    const headers = [...baseHeaders, ...dateHeaders, ...totalHeaders]

    // Title row (merged) di atas header
    const title = `Rekap Absensi — Periode ${periodLabel} — Tutup Buku 25`
    const aoa = [[title], headers]

    const histMap = new Map((history || []).map((h) => [`${h.userId}_${h.date}`, h]))
    const holidaySet = new Set((holidays || []).map((h) => h.date))
    const leaveMap = new Map()
    for (const p of pengajuan || []) {
      if (p.status !== 'approved') continue
      const s = new Date(p.startDate + 'T00:00:00')
      const e = new Date(p.endDate + 'T00:00:00')
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const k = `${p.userId}_${d.toISOString().slice(0, 10)}`
        if (!leaveMap.has(k)) leaveMap.set(k, p)
      }
    }

    // Data rows — 1 baris per orang, per tanggal isi jam / status
    ;(users || []).forEach((u, idx) => {
      const row = [idx + 1, u.fullName || u.username || '', u.nik || '-', u.division || '-']
      let cHadir = 0, cLibur = 0, cTK = 0, cCuti = 0, cSakit = 0
      dates.forEach((d) => {
        const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        const rec = histMap.get(`${u.id}_${ds}`)
        const leave = leaveMap.get(`${u.id}_${ds}`)
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        const isHoliday = holidaySet.has(ds)
        let val = ''
        let status = ''
        if (rec?.clockIn || rec?.clockOut) {
          status = 'Hadir'
          const ci = (rec.clockIn || '').replace(' WIB', '').slice(0, 5)
          const co = (rec.clockOut || '').replace(' WIB', '').slice(0, 5)
          if (ci && co) val = `${ci}\n${co}`
          else if (ci) val = ci
          else if (co) val = co
          else val = 'H'
          cHadir += 1
        } else if (leave) {
          if (leave.type === 'cuti') { status = 'Cuti'; val = 'CUTI'; cCuti += 1 }
          else if (leave.type === 'sakit') { status = 'Sakit'; val = 'SAKIT'; cSakit += 1 }
          else if (leave.type === 'lembur') { status = 'Lembur'; val = 'LMBR' }
          else { status = 'Izin'; val = 'IZIN' }
        } else if (isWeekend || isHoliday) {
          status = 'Libur'; val = 'LIBUR'; cLibur += 1
        } else if (ds > todayStr) {
          status = 'Akan Datang'; val = '-'
        } else {
          status = 'Tidak Hadir'; val = 'TK'; cTK += 1
        }
        row.push(val)
      })
      // totals
      row.push(cHadir, cLibur, cTK, cCuti, cSakit)
      aoa.push(row)
    })

    // Legend rows di bawah data (biar ga ribet tapi jelas)
    aoa.push([])
    aoa.push(['Keterangan:', '07:55 / 16:02 = jam masuk & keluar (Hadir)', 'LIBUR = merah', 'CUTI = biru, SAKIT = rose (approved)', 'TK = Tidak Hadir', '-', '-'])
    aoa.push(['', 'Periode tutup buku 25 → buka buku 26. Export ini otomatis 26 bulan lalu s/d 25 bulan ini.', '', '', '', ''])

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Merge title row
    const lastColIdx = headers.length - 1
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } }]

    // Column widths — tanggal 11 biar muat 07:55\n16:02
    const colWidths = []
    colWidths[0] = { wch: 4 } // No
    colWidths[1] = { wch: 22 } // Nama
    colWidths[2] = { wch: 16 } // NIK
    colWidths[3] = { wch: 14 } // Divisi
    for (let i = 0; i < dates.length; i++) colWidths[4 + i] = { wch: 11 } // tanggal 11
    const tBase = 4 + dates.length
    colWidths[tBase] = { wch: 7 } // Hadir
    colWidths[tBase + 1] = { wch: 7 } // Libur
    colWidths[tBase + 2] = { wch: 7 } // TK
    colWidths[tBase + 3] = { wch: 7 } // Cuti
    colWidths[tBase + 4] = { wch: 7 } // Sakit
    ws['!cols'] = colWidths

    // Row heights — data rows 30 biar 2 baris jam muat
    ws['!rows'] = []
    ws['!rows'][0] = { hpt: 22 } // title
    ws['!rows'][1] = { hpt: 28 } // header

    // Title style
    const titleEnd = XLSX.utils.encode_cell({ r: 0, c: lastColIdx })
    applyStyleRange(ws, `A1:${titleEnd}`, {
      font: { bold: true, sz: 12, color: { rgb: 'FF0F172A' }, name: 'Calibri' },
      fill: { fgColor: { rgb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: HEADER_STYLE.border,
    })

    // Header row style (row 2 -> index 1)
    const headerEnd = XLSX.utils.encode_cell({ r: 1, c: lastColIdx })
    applyStyleRange(ws, `A2:${headerEnd}`, HEADER_STYLE)
    // weekend header subtle merah biar ketahuan libur (tapi cell tetap merah)
    dates.forEach((d, i) => {
      const c = baseHeaders.length + i
      const col = colLetter(c)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      const isHoliday = holidaySet.has(ds)
      if (isWeekend || isHoliday) {
        const ref = `${col}2`
        if (ws[ref]) ws[ref].s = { ...HEADER_STYLE, fill: { fgColor: { rgb: 'FFFEE2E2' } }, font: { ...HEADER_STYLE.font, color: { rgb: 'FF991B1B' } } }
      }
    })

    // Data rows styling
    const dataStartR = 2
    const dataEndR = 2 + (users || []).length - 1
    for (let r = dataStartR; r <= dataEndR; r++) {
      const isStripe = (r - dataStartR) % 2 === 1
      for (let c = 0; c <= lastColIdx; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        let style = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
        // center align tanggal + total
        if (c >= baseHeaders.length) style = { ...style, alignment: { ...style.alignment, horizontal: 'center', vertical: 'center' } }
        // bold No
        if (c === 0) style = { ...style, alignment: { ...style.alignment, horizontal: 'center' }, font: { ...style.font, bold: true } }
        ws[ref].s = style
      }
    }
    // Styling per status: LIBUR merah, CUTI biru, SAKIT rose, TK abu, Hadir (jam) hijau dengan wrap
    for (let r = dataStartR; r <= dataEndR; r++) {
      ws['!rows'][r] = { hpt: 30 }
      for (let i = 0; i < dates.length; i++) {
        const c = baseHeaders.length + i
        const ref = XLSX.utils.encode_cell({ r, c })
        const cell = ws[ref]
        if (!cell) continue
        const v = String(cell.v || '')
        if (v === 'LIBUR') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: STATUS_FILLS['Libur'] } }, font: { bold: true, color: { rgb: STATUS_FONT_COLORS['Libur'] }, sz: 9, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' } }
        } else if (v === 'CUTI') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: STATUS_FILLS['Cuti'] } }, font: { bold: true, color: { rgb: STATUS_FONT_COLORS['Cuti'] }, sz: 9, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' } }
        } else if (v === 'SAKIT') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: STATUS_FILLS['Sakit'] } }, font: { bold: true, color: { rgb: STATUS_FONT_COLORS['Sakit'] }, sz: 9, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' } }
        } else if (v === 'TK') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: STATUS_FILLS['Tidak Hadir'] } }, font: { bold: true, color: { rgb: STATUS_FONT_COLORS['Tidak Hadir'] }, sz: 9, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' } }
        } else if (v.includes(':')) {
          // Hadir dengan jam 07:55\n16:02
          cell.s = { ...cell.s, fill: { fgColor: { rgb: STATUS_FILLS['Hadir'] } }, font: { bold: true, color: { rgb: STATUS_FONT_COLORS['Hadir'] }, sz: 9, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
        }
      }
    }
    // Totals columns bold
    for (let r = dataStartR; r <= dataEndR; r++) {
      for (let c = tBase; c <= lastColIdx; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        ws[ref].s = { ...ws[ref].s, font: { ...ws[ref].s.font, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
      }
    }

    ws['!views'] = [{ state: 'frozen', xSplit: 4, ySplit: 2 }]
    ws['!autofilter'] = { ref: `A2:${colLetter(lastColIdx)}${dataEndR + 1}` }
    // Print settings biar ga ribet pas cetak
    ws['!printHeader'] = ws['!printHeader'] || []
    ws['!margins'] = { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 }

    XLSX.utils.book_append_sheet(wb, ws, sheetNameAbsensi)
  }

  // Sheet 3: Pengajuan (cuti, sakit, lembur) - periode 26-25 juga
  {
    const headers = ['Nama', 'Username', 'Tipe', 'Mulai', 'Selesai', 'Status', 'Alasan']
    const aoa = [headers]
    // filter pengajuan yang bersentuhan dengan periode 26-25
    const startStr = `${sY}-${pad2(sM)}-26`
    const endStr = `${periodYear}-${pad2(periodMonth)}-25`
    const filtered = (pengajuan || []).filter((p) => !(p.endDate < startStr || p.startDate > endStr))
    for (const p of filtered) aoa.push([p.fullName || p.username || '', p.username || '', p.type || '', p.startDate || '', p.endDate || '', p.status || '', (p.reason || '').slice(0, 100)])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }]
    applyStyleRange(ws, `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}`, HEADER_STYLE)
    ws['!rows'] = [{ hpt: 24 }]
    for (let r = 1; r < aoa.length; r++) {
      const isStripe = r % 2 === 0
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        ws[ref].s = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
        if (c === 5) {
          const v = String(ws[ref].v || '').toLowerCase()
          const fill = v === 'approved' ? 'FFD1FAE5' : v === 'rejected' ? 'FFFFE4E6' : 'FFFEF3C7'
          const fontc = v === 'approved' ? 'FF065F46' : v === 'rejected' ? 'FF9F1239' : 'FF92400E'
          ws[ref].s = { ...ws[ref].s, fill: { fgColor: { rgb: fill } }, font: { ...ws[ref].s.font, bold: true, color: { rgb: fontc } }, alignment: { horizontal: 'center', vertical: 'center' } }
        }
      }
    }
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    ws['!autofilter'] = { ref: `A1:${colLetter(headers.length - 1)}${aoa.length}` }
    XLSX.utils.book_append_sheet(wb, ws, 'Pengajuan')
  }

  // Sheet 4: Event per bulan (beda dari absensi 26–25) — per bulan kalender, merge nomor/nama event biar enak tracking
  {
    const headers = ['No', 'Nama Event', 'Tanggal', 'Lokasi', 'Dibuat Oleh', 'Status', 'Kategori', 'Nilai PO', 'Total Biaya', 'Manpower', 'Sebagai']
    const aoa = [headers]
    // per bulan kalender 1–akhir bulan (bukan 26–25)
    const calLastDay = new Date(periodYear, periodMonth, 0).getDate()
    const calStartStr = `${periodYear}-${pad2(periodMonth)}-01`
    const calEndStr = `${periodYear}-${pad2(periodMonth)}-${pad2(calLastDay)}`
    // helper resolve creator fullName
    const userByIdEv = new Map((users || []).map((u) => [u.id, u]))
    const userByUsernameEv = new Map((users || []).map((u) => [u.username, u]))
    const resolveCreator = (raw) => {
      if (!raw) return 'Anonim'
      const s = String(raw)
      if (s.startsWith('usr_')) {
        const u = userByIdEv.get(s)
        return u?.fullName || u?.username || s
      }
      const byUname = userByUsernameEv.get(s)
      if (byUname) return byUname.fullName || s
      const byId = userByIdEv.get(s)
      if (byId) return byId.fullName || s
      return s
    }
    const CATEGORY_LABEL_EV = { kecil: 'Kecil', menengah: 'Menengah', besar: 'Besar' }
    const CATEGORY_FILLS_EV = { kecil: 'FFD1FAE5', menengah: 'FFFEF3C7', besar: 'FFFFE4E6' }
    const CATEGORY_FONTS_EV = { kecil: 'FF065F46', menengah: 'FF92400E', besar: 'FF9F1239' }
    const STATUS_FILLS_EV = { pending: 'FFFEF3C7', approved: 'FFD1FAE5', rejected: 'FFFFE4E6' }
    const STATUS_FONTS_EV = { pending: 'FF92400E', approved: 'FF065F46', rejected: 'FF9F1239' }
    const filtered = (events || []).filter((e) => {
      const s = e.startDate || e.date
      const en = e.endDate || e.startDate || e.date
      if (!s) return false
      // per bulan kalender: overlap dengan [calStartStr, calEndStr]
      return !(en < calStartStr || s > calEndStr)
    }).sort((a, b) => (a.startDate || a.date || '').localeCompare(b.startDate || b.date || ''))
    const fmtRange = (s, en) => {
      if (!s) return '-'
      const f = (d) => { const dt = new Date(d + 'T00:00:00'); return `${dt.getDate()} ${MONTH_NAMES_SHORT[dt.getMonth()]} ${dt.getFullYear()}` }
      const ss = f(s)
      if (!en || s === en) return ss
      return `${ss} — ${f(en)}`
    }
    const fmtRupiahEv = (n) => (!n || n <= 0 ? '' : 'Rp ' + Number(n).toLocaleString('id-ID'))
    let no = 1
    const merges = []
    for (const e of filtered) {
      const manpower = e.manpower || []
      const tambahan = (e.additionalCosts || []).reduce((s, c) => s + (c.amount || 0), 0)
      const totalBiaya = (e.poAmount || 0) + tambahan
      const creator = resolveCreator(e.createdBy)
      const catLabel = CATEGORY_LABEL_EV[e.poCategory] || '-'
      const range = fmtRange(e.startDate || e.date, e.endDate)
      if (manpower.length === 0) {
        aoa.push([no++, e.name || '', range, e.location || '', creator, e.status || 'approved', catLabel, fmtRupiahEv(e.poAmount), totalBiaya ? fmtRupiahEv(totalBiaya) : '', '-', '-'])
      } else {
        const startRow = aoa.length // 0-index di aoa (header di 0, data mulai 1, tapi aoa index = row excel)
        manpower.forEach((m, idx) => {
          const manName = m.name || ''
          const sebagai = Array.isArray(m.roles) ? m.roles.join(', ') : (m.role || '')
          if (idx === 0) {
            aoa.push([no, e.name || '', range, e.location || '', creator, e.status || 'approved', catLabel, fmtRupiahEv(e.poAmount), totalBiaya ? fmtRupiahEv(totalBiaya) : '', manName, sebagai])
          } else {
            // baris lanjutan event yang sama: kolom event di-merge, jadi kosongkan biar merge kelihatan
            aoa.push(['', '', '', '', '', '', '', '', '', manName, sebagai])
          }
        })
        const endRow = aoa.length - 1
        if (manpower.length > 1) {
          // merge kolom event (0–8) untuk event ini
          for (let c = 0; c <= 8; c++) {
            merges.push({ s: { r: startRow, c }, e: { r: endRow, c } })
          }
        }
        no++
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }]
    applyStyleRange(ws, `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}`, HEADER_STYLE)
    ws['!rows'] = [{ hpt: 26 }]
    // simpan merge event
    ws['!merges'] = merges
    for (let r = 1; r < aoa.length; r++) {
      const isStripe = r % 2 === 0
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        let style = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
        // untuk cell yang di-merge, tetap kasih style agar border kelihatan
        if (c === 5) {
          const v = String(ws[ref].v || '').toLowerCase()
          if (STATUS_FILLS_EV[v]) style = { ...style, fill: { fgColor: { rgb: STATUS_FILLS_EV[v] } }, font: { ...style.font, color: { rgb: STATUS_FONTS_EV[v] }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
        }
        if (c === 6) {
          const v = String(ws[ref].v || '')
          const key = Object.keys(CATEGORY_LABEL_EV).find((k) => CATEGORY_LABEL_EV[k] === v)
          if (key) style = { ...style, fill: { fgColor: { rgb: CATEGORY_FILLS_EV[key] } }, font: { ...style.font, color: { rgb: CATEGORY_FONTS_EV[key] }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
        }
        if (c === 7 || c === 8) style = { ...style, alignment: { horizontal: 'right', vertical: 'center' } }
        if (c === 10 || c === 9) style = { ...style, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } }
        if (c === 4) style = { ...style, font: { ...style.font, bold: true } }
        // vertical center untuk cell merge
        style = { ...style, alignment: { ...style.alignment, vertical: 'center' } }
        ws[ref].s = style
      }
    }
    // untuk baris merge, beri border & alignment center vertical
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    ws['!autofilter'] = { ref: `A1:${colLetter(headers.length - 1)}${aoa.length}` }
    const sheetNameEv = `Event ${MONTH_NAMES_SHORT[periodMonth - 1]} ${periodYear}`.substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetNameEv)
  }

  // Sheet 5: OKR Matrix 26–25 (tracking ga ribet — 1 baris/orang, kolom per tanggal)
  {
    const dateHeaders = dates.map((d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`)
    const baseHeaders = ['No', 'Nama', 'Divisi']
    const totalHeaders = ['Total', 'Utama', 'Lainnya', 'Hari Aktif']
    const headers = [...baseHeaders, ...dateHeaders, ...totalHeaders]
    const title = `Rekap OKR — Periode ${periodLabel} — Tutup Buku 25`
    const aoa = [[title], headers]

    // Map okr per user per tanggal
    const okrMap = new Map() // key: `${userId}_${date}` -> { total, utama, lainnya }
    const startStr = `${sY}-${pad2(sM)}-26`
    const endStr = `${periodYear}-${pad2(periodMonth)}-25`
    const filteredOkr = (okrInputs || []).filter((r) => {
      const d = (r.workDate || '').slice(0, 10)
      return d >= startStr && d <= endStr
    })
    for (const r of filteredOkr) {
      const d = (r.workDate || '').slice(0, 10)
      const key = `${r.userId || r.user_id || r.username}_${d}`
      // fallback pakai username jika userId tidak ada di okr row
      const key2 = `${r.userId || r.username}_${d}`
      const entry = okrMap.get(key) || okrMap.get(key2) || { total: 0, utama: 0, lainnya: 0 }
      // coba key pertama, jika belum ada, buat baru dengan key pertama
      const k = r.userId || r.username
      const mapKey = `${k}_${d}`
      const cur = okrMap.get(mapKey) || { total: 0, utama: 0, lainnya: 0 }
      cur.total += 1
      if (r.category === 'utama') cur.utama += 1
      else cur.lainnya += 1
      okrMap.set(mapKey, cur)
      // juga simpan dengan id asli jika ada
      if (r.userId) okrMap.set(`${r.userId}_${d}`, cur)
      if (r.username) okrMap.set(`${r.username}_${d}`, cur)
    }
    // Untuk lookup per user, kita butuh mapping user.id -> username juga
    const userById = new Map((users || []).map((u) => [u.id, u]))

    const holidaySetOkr = new Set((holidays || []).map((h) => h.date))
    const todayStr2 = new Date().toISOString().slice(0, 10)

    ;(users || []).forEach((u, idx) => {
      const row = [idx + 1, u.fullName || u.username || '', u.division || '-']
      let tot = 0, totUtama = 0, totLain = 0, hariAktif = 0
      dates.forEach((d) => {
        const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        const isHoliday = holidaySetOkr.has(ds)
        const isLibur = isWeekend || isHoliday
        const isFuture = ds > todayStr2
        // cari dengan id dan username
        const keyId = `${u.id}_${ds}`
        const keyUname = `${u.username}_${ds}`
        const entry = okrMap.get(keyId) || okrMap.get(keyUname) || { total: 0, utama: 0, lainnya: 0 }
        let val = ''
        if (isLibur) {
          val = 'LIBUR'
        } else if (isFuture) {
          val = '-'
        } else if (entry.total > 0) {
          // tampil jumlah, mis. "2" atau "1" — biar ga ribet, cukup angka
          val = String(entry.total)
          tot += entry.total
          totUtama += entry.utama
          totLain += entry.lainnya
          hariAktif += 1
        } else {
          val = '0'
        }
        // untuk LIBUR jangan hitung ke total
        if (isLibur || isFuture) {
          // jangan tambah total sudah di atas, LIBUR tidak dihitung
        } else if (entry.total === 0 && !isLibur && !isFuture) {
          // 0 tetap dihitung sebagai 0, tapi hariAktif tidak nambah
        }
        row.push(val)
      })
      // totals: total hanya dari hari kerja (sudah dihitung), tapi kita sudah hitung tot hanya untuk hari kerja dengan entry>0
      // Untuk yang LIBUR kita tidak hitung, jadi tot sudah benar
      // Tapi untuk yang 0 di hari kerja, tot tetap 0 (tidak nambah)
      row.push(tot, totUtama, totLain, hariAktif)
      aoa.push(row)
    })

    aoa.push([])
    aoa.push(['Keterangan:', 'Angka = jumlah input OKR hari itu', 'LIBUR = weekend/libur nasional (abu-abu)', '0 = tidak input di hari kerja (kuning)', '- = akan datang'])
    aoa.push(['', 'Total = semua input periode kerja', 'Utama/Lainnya = kategori', 'Hari Aktif = hari kerja dengan ≥1 input'])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const lastCol = headers.length - 1
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }]
    const colWidths = []
    colWidths[0] = { wch: 4 }
    colWidths[1] = { wch: 22 }
    colWidths[2] = { wch: 14 }
    for (let i = 0; i < dates.length; i++) colWidths[3 + i] = { wch: 7 }
    const tBase = 3 + dates.length
    colWidths[tBase] = { wch: 7 }
    colWidths[tBase + 1] = { wch: 7 }
    colWidths[tBase + 2] = { wch: 7 }
    colWidths[tBase + 3] = { wch: 7 }
    ws['!cols'] = colWidths
    ws['!rows'] = []
    ws['!rows'][0] = { hpt: 22 }
    ws['!rows'][1] = { hpt: 26 }
    const titleEnd = XLSX.utils.encode_cell({ r: 0, c: lastCol })
    applyStyleRange(ws, `A1:${titleEnd}`, {
      font: { bold: true, sz: 12, color: { rgb: 'FF0F172A' }, name: 'Calibri' },
      fill: { fgColor: { rgb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: HEADER_STYLE.border,
    })
    const headerEnd = XLSX.utils.encode_cell({ r: 1, c: lastCol })
    applyStyleRange(ws, `A2:${headerEnd}`, HEADER_STYLE)
    // weekend header abu
    dates.forEach((d, i) => {
      const c = baseHeaders.length + i
      const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const isHoliday = holidaySetOkr.has(ds)
      if (isWeekend || isHoliday) {
        const ref = `${colLetter(c)}2`
        if (ws[ref]) ws[ref].s = { ...HEADER_STYLE, fill: { fgColor: { rgb: 'FFF1F5F9' } }, font: { ...HEADER_STYLE.font, color: { rgb: 'FF64748B' } } }
      }
    })
    const dataStartR = 2
    const dataEndR = 2 + (users || []).length - 1
    for (let r = dataStartR; r <= dataEndR; r++) {
      const isStripe = (r - dataStartR) % 2 === 1
      for (let c = 0; c <= lastCol; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        let style = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
        if (c >= baseHeaders.length) style = { ...style, alignment: { ...style.alignment, horizontal: 'center', vertical: 'center' } }
        if (c === 0) style = { ...style, alignment: { horizontal: 'center', vertical: 'center' }, font: { ...style.font, bold: true } }
        ws[ref].s = style
      }
    }
    // styling khusus: LIBUR abu, 0 kuning, >0 hijau
    for (let r = dataStartR; r <= dataEndR; r++) {
      for (let i = 0; i < dates.length; i++) {
        const c = baseHeaders.length + i
        const ref = XLSX.utils.encode_cell({ r, c })
        const cell = ws[ref]
        if (!cell) continue
        if (cell.v === 'LIBUR') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: 'FFF1F5F9' } }, font: { color: { rgb: 'FF94A3B8' }, sz: 8, name: 'Calibri' } }
        } else if (cell.v === '0') {
          cell.s = { ...cell.s, fill: { fgColor: { rgb: 'FFFEF3C7' } }, font: { color: { rgb: 'FF92400E' }, bold: true, sz: 10, name: 'Calibri' } }
        } else if (cell.v === '-') {
          cell.s = { ...cell.s, font: { color: { rgb: 'FF94A3B8' }, sz: 10, name: 'Calibri' } }
        } else if (cell.v && cell.v !== '0' && cell.v !== 'LIBUR' && cell.v !== '-') {
          // ada input
          cell.s = { ...cell.s, fill: { fgColor: { rgb: 'FFD1FAE5' } }, font: { color: { rgb: 'FF065F46' }, bold: true, sz: 10, name: 'Calibri' } }
        }
      }
    }
    // totals bold
    for (let r = dataStartR; r <= dataEndR; r++) {
      for (let c = tBase; c <= lastCol; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        ws[ref].s = { ...ws[ref].s, font: { ...ws[ref].s.font, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
      }
    }
    ws['!views'] = [{ state: 'frozen', xSplit: 3, ySplit: 2 }]
    ws['!autofilter'] = { ref: `A2:${colLetter(lastCol)}${dataEndR + 1}` }
    const sheetNameOkrMatrix = `OKR ${start.getDate()}${MONTH_NAMES_SHORT[start.getMonth()]}-${end.getDate()}${MONTH_NAMES_SHORT[end.getMonth()]}${end.getFullYear()}`.substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetNameOkrMatrix)
  }

  // Sheet 5: OKR Detail (vertical, periode 26–25, untuk audit)
  {
    const headers = ['Tanggal', 'Nama', 'Username', 'Divisi', 'Kategori', 'Job', 'Judul']
    const aoa = [headers]
    const startStr = `${sY}-${pad2(sM)}-26`
    const endStr = `${periodYear}-${pad2(periodMonth)}-25`
    const filteredOkr = (okrInputs || []).filter((r) => {
      const d = (r.workDate || '').slice(0, 10)
      return d >= startStr && d <= endStr
    }).sort((a, b) => (a.workDate || '').localeCompare(b.workDate || '') || String(a.fullName||'').localeCompare(String(b.fullName||'')))
    // map user divisi
    const divByUser = new Map((users || []).map((u) => [u.id, u.division || '-']))
    const divByUname = new Map((users || []).map((u) => [u.username, u.division || '-']))
    for (const r of filteredOkr) {
      const div = divByUser.get(r.userId) || divByUname.get(r.username) || '-'
      aoa.push([(r.workDate || '').slice(0, 10), r.fullName || r.username || '', r.username || '', div, r.category === 'utama' ? 'Utama' : 'Lainnya', r.jobLabel || '-', (r.title || '').slice(0,120)])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 40 }]
    applyStyleRange(ws, `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}`, HEADER_STYLE)
    ws['!rows'] = [{ hpt: 24 }]
    for (let r = 1; r < aoa.length; r++) {
      const isStripe = r % 2 === 0
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        let style = isStripe ? { ...STRIPE_STYLE } : { ...DATA_STYLE }
        if (c === 4) style = { ...style, alignment: { ...style.alignment, horizontal: 'center' } }
        const val = String(ws[ref].v || '')
        if (c === 4 && val === 'Utama') style = { ...style, fill: { fgColor: { rgb: 'FFF5F3FF' } }, font: { ...style.font, color: { rgb: 'FF7C3AED' }, bold: true } }
        if (c === 4 && val === 'Lainnya') style = { ...style, fill: { fgColor: { rgb: 'FFF1F5F9' } }, font: { ...style.font, color: { rgb: 'FF64748B' } } }
        ws[ref].s = style
      }
    }
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    ws['!autofilter'] = { ref: `A1:${colLetter(headers.length - 1)}${aoa.length}` }
    XLSX.utils.book_append_sheet(wb, ws, 'OKR Detail')
  }

  XLSX.writeFile(wb, `hrms-global-${fileSuffix}.xlsx`)
}

export { pad2 }

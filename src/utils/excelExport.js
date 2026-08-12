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
export function exportAbsensiToExcel({ users, history, pengajuan, month, year }) {
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
  // Range: tgl 26 bulan ini → tgl 25 bulan depan
  const start = new Date(year, month - 1, 26)
  const end = new Date(year, month, 25, 23, 59, 59, 999)

  const aoa = [headers]

  users.forEach((u) => {
    const cursor = new Date(start)
    while (cursor.getTime() <= end.getTime()) {
      const date = new Date(cursor)
      const dateStr = date.toISOString().slice(0, 10)
      const rec = history.find((h) => h.userId === u.id && h.date === dateStr)
      let clockIn = ''
      let clockOut = ''
      let status = 'Tidak Hadir'
      let jamLembur = ''
      const leave = (pengajuan || []).find(
        (p) =>
          p.userId === u.id &&
          p.status === 'approved' &&
          p.startDate <= dateStr &&
          p.endDate >= dateStr,
      )
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

  // Sheet name: "26 Jun – 25 Jul 2026"
  const fmt = (d) => `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`
  const sheetName = `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
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

export { pad2 }

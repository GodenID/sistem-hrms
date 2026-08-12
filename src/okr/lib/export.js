import { getAllInputDates, getInputList } from './storage'
import {
  formatDateStringIndonesian,
  formatTimeWib,
  getTodayDateString,
} from './dateUtils'
import { OTHER_JOB_LABEL, computeJobStats, getUserJobs } from './jobs'

function escapeCSV(value) {
  if (value == null) return ''
  const str = String(value)
  const needsQuotes = /[",\n\r]/.test(str)
  const escaped = str.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function downloadCSV(filename, content) {
  if (typeof window === 'undefined') return
  const blob = new Blob(['\uFEFF' + content], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatTime(timestamp) {
  return formatTimeWib(timestamp)
}

function totalDailyTarget(user) {
  const jobs = getUserJobs(user)
  if (jobs.length === 0) {
    return user.dailyTarget ?? 0
  }
  return jobs.reduce(
    (sum, j) =>
      (j.type ?? 'standard') === 'standard' ? sum + (j.dailyTarget ?? 0) : sum,
    0
  )
}

export async function exportEmployeeCSV(user) {
  let dates = []
  try {
    dates = await getAllInputDates(user.username)
  } catch {
    dates = []
  }

  const rows = []
  rows.push(
    [
      'Tanggal',
      'Hari',
      'Job',
      'Judul',
      'Deskripsi',
      'Nominal (Rp)',
      'Waktu',
    ].join(',')
  )

  for (const date of dates) {
    let items
    try {
      items = await getInputList(user.username, date)
    } catch {
      continue
    }
    const formattedDate = formatDateStringIndonesian(date)
    for (const item of items) {
      const jobLabel = item.jobLabel ? item.jobLabel : OTHER_JOB_LABEL
      const nominal =
        typeof item.nominalIDR === 'number' && item.nominalIDR > 0
          ? String(Math.round(item.nominalIDR))
          : ''
      rows.push(
        [
          escapeCSV(date),
          escapeCSV(formattedDate),
          escapeCSV(jobLabel),
          escapeCSV(item.title),
          escapeCSV(item.description),
          escapeCSV(nominal),
          escapeCSV(formatTime(item.timestamp)),
        ].join(',')
      )
    }
  }

  const filename = `laporan_${user.username}_${getTodayDateString()}.csv`
  downloadCSV(filename, rows.join('\n'))
}

export async function exportTeamSummaryCSV(employees) {
  const rows = []
  rows.push(
    [
      'Username',
      'Nama',
      'Role',
      'Tanggal',
      'Jumlah Item',
      'Total Target Harian',
      'Persentase Rata-rata',
    ].join(',')
  )

  for (const emp of employees) {
    let dates = []
    try {
      dates = await getAllInputDates(emp.username)
    } catch {
      dates = []
    }

    for (const date of dates) {
      let items
      try {
        items = await getInputList(emp.username, date)
      } catch {
        continue
      }
      const stats = computeJobStats(emp, items)
      const totalTarget = totalDailyTarget(emp)

      rows.push(
        [
          escapeCSV(emp.username),
          escapeCSV(emp.fullName),
          escapeCSV(emp.role),
          escapeCSV(date),
          String(stats.totalCount),
          String(totalTarget),
          `${stats.overallPercentage}%`,
        ].join(',')
      )
    }
  }

  const filename = `laporan_tim_${getTodayDateString()}.csv`
  downloadCSV(filename, rows.join('\n'))
}

export async function exportTodaySnapshotCSV(employees, todayDate) {
  const rows = []
  rows.push(
    [
      'Username',
      'Nama',
      'Role',
      'Total Target',
      'Tercapai',
      'Persentase Rata-rata',
      'Status',
    ].join(',')
  )

  for (const emp of employees) {
    let items = []
    try {
      items = await getInputList(emp.username, todayDate)
    } catch {
      items = []
    }
    const stats = computeJobStats(emp, items)
    const totalTarget = totalDailyTarget(emp)

    let status
    if (stats.totalCount === 0) status = 'Belum Input'
    else if (stats.allMet) status = 'Tercapai'
    else if (stats.overallPercentage >= 50) status = 'On Track'
    else status = 'Underperform'

    rows.push(
      [
        escapeCSV(emp.username),
        escapeCSV(emp.fullName),
        escapeCSV(emp.role),
        String(totalTarget),
        String(stats.totalCount),
        `${stats.overallPercentage}%`,
        escapeCSV(status),
      ].join(',')
    )
  }

  const filename = `snapshot_hari_ini_${todayDate}.csv`
  downloadCSV(filename, rows.join('\n'))
}

export function exportMonitoringCSV(employees, buckets, matrix, granularityLabel) {
  const rows = []
  rows.push(
    [
      'Username',
      'Nama',
      'Role',
      'Periode',
      'Mulai',
      'Selesai',
      'Granularitas',
      'Hari Aktif',
      'Hari Kerja',
      'Hari Tercapai',
      'Total Item',
      'Total Target',
      'PO Count',
      'PO Nominal (Rp)',
    ].join(',')
  )
  for (const emp of employees) {
    const bucketStats = matrix.get(emp.username)
    if (!bucketStats) continue
    for (const b of buckets) {
      const s = bucketStats.get(b.key)
      if (!s) continue
      rows.push(
        [
          escapeCSV(emp.username),
          escapeCSV(emp.fullName),
          escapeCSV(emp.role),
          escapeCSV(b.label),
          escapeCSV(b.startDate),
          escapeCSV(b.endDate),
          escapeCSV(granularityLabel),
          String(s.daysActive),
          String(s.workingDays),
          String(s.daysAllMet),
          String(s.totalCount),
          String(s.totalTarget),
          String(s.poCount),
          String(s.poTotalIDR),
        ].join(',')
      )
    }
  }
  const filename = `monitoring_${getTodayDateString()}.csv`
  downloadCSV(filename, rows.join('\n'))
}

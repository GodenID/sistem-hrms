import { getInputRange } from './storage'
import { getTodayDateString } from './dateUtils'

export const OTHER_JOB_ID = '__other__'
export const OTHER_JOB_LABEL = 'Lainnya'

export function getJobType(job) {
  return job.type ?? 'standard'
}

export function isPOJob(job) {
  return getJobType(job) === 'po'
}

export function formatIDR(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'Rp 0'
  }
  const rounded = Math.round(amount)
  return `Rp ${rounded.toLocaleString('id-ID')}`
}

export function parseIDR(input) {
  if (!input) return NaN
  const raw = input.trim().toLowerCase()
  const suffixMatch = raw.match(/^([0-9.,]+)\s*(jt|juta|rb|ribu|k|m|miliar)$/)
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(/\./g, '').replace(/,/g, '.'))
    if (!Number.isFinite(num)) return NaN
    const mult = {
      jt: 1_000_000,
      juta: 1_000_000,
      rb: 1_000,
      ribu: 1_000,
      k: 1_000,
      m: 1_000_000_000,
      miliar: 1_000_000_000,
    }
    return Math.round(num * (mult[suffixMatch[2]] ?? 1))
  }
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return NaN
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : NaN
}

export function getUserJobs(user) {
  return user.jobs ?? []
}

export function buildItemTitle(jobLabel, typed) {
  const t = typed.trim()
  if (!jobLabel) return t
  return `${jobLabel} - ${t}`
}

export function getItemTypedSuffix(item) {
  if (!item.jobLabel) return item.title
  const prefix = `${item.jobLabel} - `
  if (item.title.startsWith(prefix)) {
    return item.title.slice(prefix.length)
  }
  return item.title
}

export function computeJobStats(user, items) {
  const userJobs = getUserJobs(user)
  const standardJobs = userJobs.filter((j) => !isPOJob(j))
  const jobs = standardJobs.map((job) => {
    const target = job.dailyTarget ?? 0
    const count = items.filter((i) => i.jobId === job.id).length
    const percentage =
      target === 0 ? 0 : Math.min(100, Math.round((count / target) * 100))
    return {
      job,
      count,
      percentage,
      isMet: target > 0 && count >= target,
    }
  })

  const knownJobIds = new Set(userJobs.map((j) => j.id))
  const otherCount = items.filter(
    (i) => !i.jobId || !knownJobIds.has(i.jobId)
  ).length

  const totalCount = items.length
  const overallPercentage =
    jobs.length === 0
      ? 0
      : Math.round(jobs.reduce((s, j) => s + j.percentage, 0) / jobs.length)
  const allMet = jobs.length > 0 && jobs.every((j) => j.isMet)

  return { jobs, otherCount, totalCount, overallPercentage, allMet }
}

export async function computePOMonthlyStats(
  user,
  yyyyMm = getTodayDateString().slice(0, 7)
) {
  const poJobs = getUserJobs(user).filter(isPOJob)
  if (poJobs.length === 0) {
    return { month: yyyyMm, jobs: [], allMet: false }
  }

  const [yStr, mStr] = yyyyMm.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const totals = new Map()
  for (const job of poJobs) {
    totals.set(job.id, { sum: 0, count: 0, newCount: 0, repeatCount: 0 })
  }

  const firstDay = `${yyyyMm}-01`
  const lastDay = `${yyyyMm}-${String(daysInMonth).padStart(2, '0')}`
  const monthItems = await getInputRange(user.username, firstDay, lastDay)
  for (const it of monthItems) {
    if (!it.jobId) continue
    const bucket = totals.get(it.jobId)
    if (!bucket) continue
    const nominal =
      typeof it.nominalIDR === 'number' && Number.isFinite(it.nominalIDR)
        ? Math.max(0, Math.round(it.nominalIDR))
        : 0
    bucket.sum += nominal
    bucket.count += 1
    if (it.customerKind === 'baru') bucket.newCount += 1
    else if (it.customerKind === 'lama') bucket.repeatCount += 1
  }

  const jobs = poJobs.map((job) => {
    const bucket =
      totals.get(job.id) ?? {
        sum: 0,
        count: 0,
        newCount: 0,
        repeatCount: 0,
      }
    const target = job.monthlyTargetIDR ?? 0
    const percentage =
      target <= 0
        ? 0
        : Math.min(100, Math.round((bucket.sum / target) * 100))
    return {
      job,
      totalIDR: bucket.sum,
      count: bucket.count,
      newCount: bucket.newCount,
      repeatCount: bucket.repeatCount,
      percentage,
      isMet: target > 0 && bucket.sum >= target,
    }
  })

  const allMet = jobs.length > 0 && jobs.every((j) => j.isMet)
  return { month: yyyyMm, jobs, allMet }
}

export async function getMonthlyPOItems(
  user,
  yyyyMm = getTodayDateString().slice(0, 7)
) {
  const userJobs = getUserJobs(user)
  const poJobIds = new Set(userJobs.filter(isPOJob).map((j) => j.id))
  if (poJobIds.size === 0) return []

  const [yStr, mStr] = yyyyMm.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const firstDay = `${yyyyMm}-01`
  const lastDay = `${yyyyMm}-${String(daysInMonth).padStart(2, '0')}`
  const monthItems = await getInputRange(user.username, firstDay, lastDay)

  const out = []
  for (const item of monthItems) {
    if (!item.jobId) continue
    if (!poJobIds.has(item.jobId)) continue
    const date = (item.workDate || item.date || '').slice(0, 10)
    const job = userJobs.find((j) => j.id === item.jobId) ?? null
    out.push({ date, item, job })
  }
  out.sort((a, b) => {
    const ta = a.item.timestamp || a.date
    const tb = b.item.timestamp || b.date
    return ta.localeCompare(tb)
  })
  return out
}

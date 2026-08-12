import { getInputRange } from './storage'
import { computeJobStats, getUserJobs, isPOJob } from './jobs'

const SHORT_BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseYmd(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map((s) => parseInt(s, 10))
  return { y, m, d }
}

function addDays(yyyyMmDd, days) {
  const { y, m, d } = parseYmd(yyyyMmDd)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate()
  )}`
}

export function enumerateDays(start, end) {
  if (end < start) return []
  const out = []
  let cursor = start
  for (let i = 0; i < 400 && cursor <= end; i++) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

function getWeekday(yyyyMmDd) {
  const { y, m, d } = parseYmd(yyyyMmDd)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function isoWeekStart(yyyyMmDd) {
  const w = getWeekday(yyyyMmDd)
  const back = w === 0 ? 6 : w - 1
  return addDays(yyyyMmDd, -back)
}

function isoWeekEnd(yyyyMmDd) {
  return addDays(isoWeekStart(yyyyMmDd), 6)
}

function isoWeekNumber(yyyyMmDd) {
  const { y, m, d } = parseYmd(yyyyMmDd)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dow)
  const isoYear = dt.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return [isoYear, week]
}

export function buildBuckets(start, end, granularity) {
  if (end < start) return []

  if (granularity === 'day') {
    return enumerateDays(start, end).map((d) => {
      const { d: day, m } = parseYmd(d)
      return {
        key: d,
        label: `${pad2(day)} ${SHORT_BULAN[m - 1]}`,
        startDate: d,
        endDate: d,
      }
    })
  }

  if (granularity === 'week') {
    const buckets = []
    let cursor = isoWeekStart(start)
    for (let i = 0; i < 60 && cursor <= end; i++) {
      const wkEnd = isoWeekEnd(cursor)
      const clampedStart = cursor < start ? start : cursor
      const clampedEnd = wkEnd > end ? end : wkEnd
      const [, wk] = isoWeekNumber(cursor)
      buckets.push({
        key: `${cursor}_w${wk}`,
        label: `W${wk} · ${pad2(parseYmd(clampedStart).d)}–${pad2(parseYmd(clampedEnd).d)} ${
          SHORT_BULAN[parseYmd(clampedEnd).m - 1]
        }`,
        startDate: clampedStart,
        endDate: clampedEnd,
      })
      cursor = addDays(wkEnd, 1)
    }
    return buckets
  }

  const buckets = []
  let { y: cy, m: cm } = parseYmd(start)
  const { y: ey, m: em } = parseYmd(end)
  for (let i = 0; i < 36; i++) {
    const monthStart = `${cy}-${pad2(cm)}-01`
    const lastDay = new Date(Date.UTC(cy, cm, 0)).getUTCDate()
    const monthEnd = `${cy}-${pad2(cm)}-${pad2(lastDay)}`
    const clampedStart = monthStart < start ? start : monthStart
    const clampedEnd = monthEnd > end ? end : monthEnd
    buckets.push({
      key: `${cy}-${pad2(cm)}`,
      label: `${SHORT_BULAN[cm - 1]} ${cy}`,
      startDate: clampedStart,
      endDate: clampedEnd,
    })
    if (cy === ey && cm === em) break
    cm += 1
    if (cm === 13) {
      cm = 1
      cy += 1
    }
  }
  return buckets
}

export async function computeBucketStat(user, bucket) {
  const userJobs = getUserJobs(user)
  const standardTargetPerDay = userJobs.reduce(
    (sum, j) =>
      (j.type ?? 'standard') === 'standard' ? sum + (j.dailyTarget ?? 0) : sum,
    0
  )
  let totalCount = 0
  let daysAllMet = 0
  let daysActive = 0
  let workingDays = 0
  let totalTarget = 0
  let poCount = 0
  let poTotalIDR = 0
  let otherCount = 0

  const perJob = new Map()
  for (const j of userJobs) {
    perJob.set(j.id, { count: 0, totalIDR: 0 })
  }
  const knownJobIds = new Set(userJobs.map((j) => j.id))

  const days = enumerateDays(bucket.startDate, bucket.endDate)
  const bucketItems = await getInputRange(
    user.username,
    bucket.startDate,
    bucket.endDate
  )
  const itemsByDate = new Map()
  for (const it of bucketItems) {
    const d = (it.workDate || it.date || '').slice(0, 10)
    if (!itemsByDate.has(d)) itemsByDate.set(d, [])
    itemsByDate.get(d).push(it)
  }

  for (const date of days) {
    const w = getWeekday(date)
    const isWorking = w !== 0 && w !== 6
    if (isWorking) {
      workingDays += 1
      totalTarget += standardTargetPerDay
    }
    const items = itemsByDate.get(date) || []
    if (items.length > 0) daysActive += 1
    totalCount += items.length
    const stats = computeJobStats(user, items)
    if (isWorking && standardTargetPerDay > 0 && stats.allMet) {
      daysAllMet += 1
    }
    for (const it of items) {
      if (typeof it.nominalIDR === 'number' && it.nominalIDR > 0) {
        poCount += 1
        poTotalIDR += Math.round(it.nominalIDR)
      }
      if (!it.jobId || !knownJobIds.has(it.jobId)) {
        otherCount += 1
        continue
      }
      const bucketAgg = perJob.get(it.jobId)
      if (!bucketAgg) continue
      bucketAgg.count += 1
      if (typeof it.nominalIDR === 'number' && it.nominalIDR > 0) {
        bucketAgg.totalIDR += Math.round(it.nominalIDR)
      }
    }
  }

  const jobs = userJobs.map((job) => {
    const agg = perJob.get(job.id) ?? { count: 0, totalIDR: 0 }
    if (isPOJob(job)) {
      const target = job.monthlyTargetIDR ?? 0
      return {
        job,
        type: 'po',
        count: agg.count,
        totalIDR: agg.totalIDR,
        target,
        isMet: target > 0 && agg.totalIDR >= target,
      }
    }
    const dailyTarget = job.dailyTarget ?? 0
    const stdTarget = dailyTarget * workingDays
    return {
      job,
      type: 'standard',
      count: agg.count,
      totalIDR: 0,
      target: stdTarget,
      isMet: stdTarget > 0 && agg.count >= stdTarget,
    }
  })

  return {
    totalCount,
    totalTarget,
    daysAllMet,
    daysActive,
    workingDays,
    poCount,
    poTotalIDR,
    jobs,
    otherCount,
  }
}

export function currentMonthRange(today) {
  const { y, m } = parseYmd(today)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(lastDay)}`,
  }
}

export function currentWeekRange(today) {
  return { start: isoWeekStart(today), end: isoWeekEnd(today) }
}

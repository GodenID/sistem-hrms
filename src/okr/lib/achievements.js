import { getInputRange } from './storage'
import { computePOMonthlyStats } from './jobs'

export const ACHIEVEMENTS = {
  TOP_1_MONTH: {
    id: 'TOP_1_MONTH',
    emoji: '🥇',
    label: 'Top 1 Bulan Ini',
    description: 'PO terbesar di tim untuk bulan ini.',
  },
  COMEBACK: {
    id: 'COMEBACK',
    emoji: '🆙',
    label: 'Comeback',
    description: 'Bulan ini lebih dari 200% bulan lalu.',
  },
  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    emoji: '⏱️',
    label: 'Speed Demon',
    description: '5 input atau lebih dalam 1 jam.',
  },
  UNICORN: {
    id: 'UNICORN',
    emoji: '🦄',
    label: 'Unicorn',
    description: 'Single PO ≥ Rp 1 miliar.',
  },
}

const STORAGE_PREFIX = 'dit_achv_unlocked_'

function key(username) {
  return `${STORAGE_PREFIX}${username}`
}

export function getAnnouncedAchievements(username) {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(key(username))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.filter((s) => typeof s === 'string'))
  } catch {
    // fall through
  }
  return new Set()
}

export function setAnnouncedAchievements(username, ids) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(username), JSON.stringify(Array.from(ids)))
  } catch {
    // silently ignore
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function previousYyyyMm(yyyyMm) {
  const [yStr, mStr] = yyyyMm.split('-')
  let y = parseInt(yStr, 10)
  let m = parseInt(mStr, 10) - 1
  if (m === 0) {
    m = 12
    y -= 1
  }
  return `${y}-${pad2(m)}`
}

async function computeUserSignals(user, todayDate) {
  const yyyyMm = todayDate.slice(0, 7)
  const prevMm = previousYyyyMm(yyyyMm)

  const monthStats = await computePOMonthlyStats(user, yyyyMm)
  const prevMonthStats = await computePOMonthlyStats(user, prevMm)

  let maxSinglePO = 0
  let monthPOTotal = 0
  let speedDemon = false

  const [yStr, mStr] = yyyyMm.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthItems = await getInputRange(
    user.username,
    `${yyyyMm}-01`,
    `${yyyyMm}-${pad2(last)}`
  )
  const stamps = []
  for (const it of monthItems) {
    if (it.timestamp) {
      const t = new Date(it.timestamp).getTime()
      if (Number.isFinite(t)) stamps.push(t)
    }
    if (typeof it.nominalIDR === 'number' && it.nominalIDR > 0) {
      const n = Math.round(it.nominalIDR)
      if (n > maxSinglePO) maxSinglePO = n
      monthPOTotal += n
    }
  }
  if (stamps.length >= 5) {
    stamps.sort((a, b) => a - b)
    for (let i = 0; i + 4 < stamps.length; i++) {
      if (stamps[i + 4] - stamps[i] <= 60 * 60 * 1000) {
        speedDemon = true
        break
      }
    }
  }

  const prevMonthPOTotal = prevMonthStats.jobs.reduce(
    (sum, j) => sum + j.totalIDR,
    0
  )

  return { maxSinglePO, monthPOTotal, prevMonthPOTotal, speedDemon }
}

const UNICORN_THRESHOLD_IDR = 1_000_000_000

export async function computeTeamAchievements(users, todayDate) {
  const out = new Map()
  if (users.length === 0) return out

  const signalsByUser = new Map()
  for (const u of users) {
    signalsByUser.set(u.username, await computeUserSignals(u, todayDate))
  }

  let topUser = null
  let topValue = 0
  let topTied = false
  for (const [username, s] of signalsByUser) {
    if (s.monthPOTotal <= 0) continue
    if (s.monthPOTotal > topValue) {
      topValue = s.monthPOTotal
      topUser = username
      topTied = false
    } else if (s.monthPOTotal === topValue) {
      topTied = true
    }
  }
  if (topTied) topUser = null

  for (const u of users) {
    const s = signalsByUser.get(u.username)
    if (!s) {
      out.set(u.username, [])
      continue
    }
    const earned = []
    if (topUser === u.username) earned.push(ACHIEVEMENTS.TOP_1_MONTH)
    if (s.prevMonthPOTotal > 0 && s.monthPOTotal > 2 * s.prevMonthPOTotal) {
      earned.push(ACHIEVEMENTS.COMEBACK)
    }
    if (s.speedDemon) earned.push(ACHIEVEMENTS.SPEED_DEMON)
    if (s.maxSinglePO >= UNICORN_THRESHOLD_IDR) earned.push(ACHIEVEMENTS.UNICORN)
    out.set(u.username, earned)
  }

  return out
}

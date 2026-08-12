import { api } from '../../services/api'

// ---------------------------------------------------------------------------
// Input harian — semua data disimpan di server (API), tanpa localStorage.
// Fungsi-fungsi ini async dan dipakai oleh context/page OKR.
// ---------------------------------------------------------------------------

export async function getInputList(username, date) {
  try {
    const res = await api(`/okr/inputs?username=${encodeURIComponent(username)}&date=${date}`)
    return res.inputs || []
  } catch (err) {
    console.error('Gagal memuat input:', err.message)
    return []
  }
}

export async function setInputList(username, date, items) {
  // Item yang ada di server di-update/dihapus; item baru dibuat.
  try {
    const existing = await getInputList(username, date)
    const existingIds = new Set(existing.map((i) => i.id))
    const nextIds = new Set(items.map((i) => i.id))
    for (const old of existing) {
      if (!nextIds.has(old.id)) {
        await api(`/okr/inputs/${old.id}`, { method: 'DELETE' })
      }
    }
    for (const item of items) {
      const payload = {
        username,
        workDate: date,
        title: item.title,
        description: item.description || '',
        jobId: item.jobId || null,
        jobLabel: item.jobLabel || null,
        nominalIDR: item.nominalIDR ?? null,
        customerKind: item.customerKind ?? null,
      }
      if (existingIds.has(item.id)) {
        await api(`/okr/inputs/${item.id}`, { method: 'PUT', body: payload })
      } else {
        await api('/okr/inputs', { method: 'POST', body: payload })
      }
    }
    return true
  } catch (err) {
    console.error('Gagal menyimpan input:', err.message)
    return false
  }
}

export async function clearAllInputsForUser(username) {
  try {
    const res = await api(`/okr/inputs/dates?username=${encodeURIComponent(username)}`)
    const dates = res.dates || []
    for (const date of dates) {
      const items = await getInputList(username, date)
      for (const item of items) {
        await api(`/okr/inputs/${item.id}`, { method: 'DELETE' })
      }
    }
    return true
  } catch (err) {
    console.error('Gagal menghapus input user:', err.message)
    return false
  }
}

export async function getAllInputDates(username) {
  try {
    const res = await api(`/okr/inputs/dates?username=${encodeURIComponent(username)}`)
    const dates = res.dates || []
    dates.sort((a, b) => b.localeCompare(a))
    return dates
  } catch (err) {
    console.error('Gagal memuat tanggal input:', err.message)
    return []
  }
}

export async function getInputRange(username, from, to) {
  try {
    const res = await api(
      `/okr/inputs?username=${encodeURIComponent(username)}&from=${from}&to=${to}`
    )
    return res.inputs || []
  } catch (err) {
    console.error('Gagal memuat rentang input:', err.message)
    return []
  }
}

export async function getAllEmployeeDates() {
  try {
    const res = await api('/okr/inputs/all-dates')
    const map = res.datesByUser || {}
    for (const username of Object.keys(map)) {
      map[username].sort((a, b) => b.localeCompare(a))
    }
    return new Map(Object.entries(map))
  } catch (err) {
    console.error('Gagal memuat tanggal input semua karyawan:', err.message)
    return new Map()
  }
}

// ---------------------------------------------------------------------------
// Draft (in-progress add form) — hanya state UI sementara, tetap lokal
// ---------------------------------------------------------------------------

const DRAFT_KEY_PREFIX = 'dit_draft_v2_'

export function isLocalStorageAvailable() {
  try {
    const testKey = '__dit_storage_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function draftKey(username) {
  return `${DRAFT_KEY_PREFIX}${username}_add`
}

export function getDraft(username) {
  if (!isLocalStorageAvailable()) return null
  try {
    const raw = localStorage.getItem(draftKey(username))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      jobId: typeof parsed.jobId === 'string' ? parsed.jobId : null,
      titleSuffix: typeof parsed.titleSuffix === 'string' ? parsed.titleSuffix : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
    }
  } catch {
    return null
  }
}

export function setDraft(username, draft) {
  if (!isLocalStorageAvailable()) return
  try {
    localStorage.setItem(draftKey(username), JSON.stringify(draft))
  } catch {
    // silently ignore
  }
}

export function clearDraft(username) {
  if (!isLocalStorageAvailable()) return
  try {
    localStorage.removeItem(draftKey(username))
  } catch {
    // silently ignore
  }
}

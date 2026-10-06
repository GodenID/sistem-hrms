import React from 'react'

// Fuzzy: semua karakter query muncul berurutan di text (case-insensitive)
// "bdi" cocok "Budi" (b→d→i), "ad" cocok "Ahmad" (a→d)
export function fuzzyMatch(text, query) {
  if (!query) return true
  const t = String(text || '').toLowerCase()
  const q = String(query || '').toLowerCase().trim()
  if (!q) return true
  if (t.includes(q)) return true
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return false
    ti = idx + 1
  }
  return true
}

export function fuzzyFilter(items, query, fields) {
  if (!query?.trim()) return items
  const q = query.trim().toLowerCase()
  return items.filter((it) =>
    fields.some((f) => fuzzyMatch(String(it[f] ?? ''), q))
  )
}

// Highlight: bungkus substring yang cocok dengan <mark> kuning.
// Jika tidak ada substring langsung, fallback highlight karakter fuzzy per huruf.
export function Highlight({ text, query }) {
  const t = String(text || '')
  const q = String(query || '').trim()
  if (!q) return t
  const lowerT = t.toLowerCase()
  const lowerQ = q.toLowerCase()
  const idx = lowerT.indexOf(lowerQ)
  if (idx !== -1) {
    const before = t.slice(0, idx)
    const match = t.slice(idx, idx + q.length)
    const after = t.slice(idx + q.length)
    return (
      <>
        {before}
        <mark className="rounded bg-yellow-200 px-0.5 font-bold text-slate-900">{match}</mark>
        {after}
      </>
    )
  }
  // fuzzy per karakter
  let ti = 0
  const nodes = []
  let last = 0
  for (let qi = 0; qi < lowerQ.length; qi++) {
    const ch = lowerQ[qi]
    const found = lowerT.indexOf(ch, ti)
    if (found === -1) break
    if (found > last) nodes.push(t.slice(last, found))
    nodes.push(
      <mark key={`${qi}-${found}`} className="rounded bg-yellow-200 px-0.5 font-bold text-slate-900">
        {t[found]}
      </mark>,
    )
    last = found + 1
    ti = found + 1
  }
  if (nodes.length === 0) return t
  nodes.push(t.slice(last))
  return <>{nodes}</>
}

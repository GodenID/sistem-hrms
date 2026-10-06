import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { dateToKey } from '../utils/period'

function wibTodayKey() {
  const now = new Date()
  const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60_000)
  return dateToKey(wib)
}

function formatLong(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function JobHistoryPage() {
  const { currentUser } = useAuth()
  const today = wibTodayKey()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    setLoading(true)
    api(`/okr/inputs?from=1900-01-01&to=${today}`)
      .then((res) => {
        if (cancelled) return
        setItems(res.inputs || [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [currentUser, today])

  const jobs = Array.isArray(currentUser?.primaryJobs) ? currentUser.primaryJobs : []

  const dates = useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const key = (it.workDate || '').slice(0, 10)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    return [...map.entries()]
      .map(([date, list]) => {
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        const utama = list.filter((i) => i.category === 'utama').length
        const lainnya = list.filter((i) => i.category === 'lainnya').length
        const doneJobs = jobs.filter((j) =>
          list.some((i) => i.category === 'utama' && i.jobLabel === j.label)
        )
        return { date, list, utama, lainnya, doneJobs }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [items, jobs])

  const filtered = useMemo(() => {
    if (!query.trim()) return dates
    const q = query.toLowerCase().trim()
    return dates.filter((d) => {
      if (d.date.includes(q) || formatLong(d.date).toLowerCase().includes(q)) return true
      return d.list.some(
        (i) =>
          (i.title || '').toLowerCase().includes(q) ||
          (i.jobLabel || '').toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q)
      )
    })
  }, [dates, query])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <Link to="/okr" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <h1 className="ml-auto text-base font-semibold tracking-tight text-slate-900">Riwayat</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari tanggal, judul, atau kategori"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-indigo-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Memuat…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Belum ada riwayat.</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {filtered.map((d) => (
              <li key={d.date}>
                <details className="group rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{formatLong(d.date)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {d.utama} utama · {d.lainnya} lainnya
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <ul className="space-y-2 border-t border-slate-100 p-4">
                    {d.list.map((it) => (
                      <li key={it.id} className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          it.category === 'utama'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {it.category === 'utama' ? it.jobLabel || 'Utama' : 'Lainnya'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-900">{it.title}</p>
                          {it.description && (
                            <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
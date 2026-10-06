import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, History, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useHolidays } from '../context/HolidaysContext'
import { api } from '../services/api'
import { dateToKey } from '../utils/period'

function wibTodayKey() {
  const now = new Date()
  const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60_000)
  return dateToKey(wib)
}

function formatTodayLong(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function JobDashboardPage() {
  const { currentUser } = useAuth()
  const { isHoliday } = useHolidays()
  const today = wibTodayKey()
  const offDay = isHoliday(today)

  const [items, setItems] = useState([])
  const [isLoading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const primaryJobs = Array.isArray(currentUser?.primaryJobs) ? currentUser.primaryJobs : []
  const usableJobs = offDay ? [] : primaryJobs

  const refresh = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await api(`/okr/inputs?date=${today}`)
      setItems(res.inputs || [])
    } catch (err) {
      console.error('Gagal memuat input:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser, today])

  useEffect(() => { refresh() }, [refresh])

  const handleDelete = async (id) => {
    if (!confirm('Hapus input ini?')) return
    try {
      await api(`/okr/inputs/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      alert(err.message || 'Gagal menghapus')
    }
  }

  const todayJobs = useMemo(() => primaryJobs.map((j) => {
    const count = items.filter((i) => i.category === 'utama' && i.jobLabel === j.label).length
    const pct = j.target ? Math.min(100, Math.round((count / j.target) * 100)) : 0
    return { ...j, count, pct, done: count >= j.target }
  }), [items, primaryJobs])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            HRMS
          </Link>
          <h1 className="text-base font-semibold tracking-tight text-slate-900">Daily Job</h1>
          <Link to="/okr/history" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <History className="h-4 w-4" />
            Riwayat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-xs uppercase tracking-wider text-slate-500">Hari ini</p>
        <h2 className="text-lg font-bold text-slate-900">{formatTodayLong(today)}</h2>

        {offDay && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Hari ini libur — hanya kategori <strong>Lainnya</strong> yang bisa diinput.
          </div>
        )}

        {todayJobs.length > 0 && (
          <section className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Target Job Utama</h3>
            {todayJobs.map((j) => (
              <div key={j.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{j.label}</span>
                  <span className={`text-sm tabular-nums ${j.done ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {j.count}/{j.target} · {j.pct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={j.done ? 'h-full bg-emerald-500' : 'h-full bg-indigo-500'}
                    style={{ width: `${j.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {j.unit === 'nominal' ? 'Target nominal' : 'Target jumlah'}
                </p>
              </div>
            ))}
          </section>
        )}

        {primaryJobs.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Belum ada job utama. Hubungi admin untuk disetel.
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Input Hari Ini</h3>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </button>
            )}
          </div>

          {showForm && (
            <InputForm
              jobs={usableJobs}
              workDate={today}
              onSaved={async () => {
                setShowForm(false)
                await refresh()
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Memuat…</p>
          ) : items.length === 0 ? (
            !showForm && <p className="text-sm text-slate-500">Belum ada input hari ini.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          it.category === 'utama'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {it.category === 'utama' ? it.jobLabel || 'Utama' : 'Lainnya'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">{it.title}</p>
                      {it.description && (
                        <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(it.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function InputForm({ jobs, workDate, onSaved, onCancel }) {
  const [category, setCategory] = useState(jobs.length > 0 ? 'utama' : 'lainnya')
  const [jobLabel, setJobLabel] = useState(jobs[0]?.label || '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (category === 'utama' && jobs.length > 0 && !jobs.some((j) => j.label === jobLabel)) {
      setJobLabel(jobs[0].label)
    }
  }, [category, jobs, jobLabel])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Judul wajib diisi')
      return
    }
    if (category === 'utama' && !jobLabel) {
      setError('Pilih job utama')
      return
    }
    setBusy(true)
    try {
      await api('/okr/inputs', {
        method: 'POST',
        body: {
          category,
          jobLabel: category === 'utama' ? jobLabel : null,
          title: trimmed,
          description: description.trim(),
          workDate,
        },
      })
      onSaved()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {jobs.map((j) => (
          <button
            key={j.label}
            type="button"
            onClick={() => { setCategory('utama'); setJobLabel(j.label) }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              category === 'utama' && jobLabel === j.label
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {j.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCategory('lainnya')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            category === 'lainnya'
              ? 'border-slate-700 bg-slate-700 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          Lainnya
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={category === 'utama' ? 'Detail / nama pekerjaan' : 'Judul pekerjaan'}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Deskripsi (opsional)"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
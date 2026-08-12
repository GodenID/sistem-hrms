import React, { useState } from 'react'
import { useLocations } from '../context/LocationContext'
import MapPicker from './MapPicker'

function LocationForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [lat, setLat] = useState(initial?.lat || -6.2088)
  const [lng, setLng] = useState(initial?.lng || 106.8456)
  const [radius, setRadius] = useState(initial?.radius || 100)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nama lokasi wajib diisi.')
      return
    }
    onSave({ name, lat, lng, radius })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Nama Lokasi</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          placeholder="Contoh: Toko Pusat"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Pilih Lokasi di Peta</label>
        <MapPicker lat={lat} lng={lng} onMove={(newLat, newLng) => { setLat(newLat); setLng(newLng) }} />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Longitude</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value))}
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Radius (meter)</label>
        <input
          type="number"
          min={10}
          max={1000}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        <p className="mt-0.5 text-[10px] text-slate-400">Jarak maksimal dari lokasi (default: 100m)</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
            Batal
          </button>
        )}
        <button type="submit" className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]">
          {initial ? 'Simpan' : 'Tambah Lokasi'}
        </button>
      </div>
    </form>
  )
}

function LocationCard({ loc, onEdit, onDelete }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">{loc.name}</p>
        <p className="text-[10px] text-slate-500">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
        <p className="text-[10px] text-slate-500">Radius: {loc.radius}m</p>
      </div>
      <div className="flex gap-1">
        <button onClick={() => onEdit(loc)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50">
          Edit
        </button>
        <button onClick={() => onDelete(loc)} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-50">
          Hapus
        </button>
      </div>
    </div>
  )
}

export default function LocationsTab() {
  const { locations, addLocation, updateLocation, removeLocation } = useLocations()
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const handleSave = (data) => {
    if (editing) {
      updateLocation(editing.id, data)
      setEditing(null)
    } else {
      addLocation(data)
    }
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Lokasi Absensi</h3>
          <p className="text-xs text-slate-500">Maksimal 4 lokasi. Karyawan hanya bisa absen di area ini.</p>
        </div>
        {locations.length < 4 && !showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Tambah
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <div className="card p-4">
          <LocationForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      )}

      {locations.length === 0 && !showForm ? (
        <div className="card flex flex-col items-center justify-center px-6 py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-900">Belum ada lokasi</p>
          <p className="mt-1 text-xs text-slate-500">Tambah lokasi agar karyawan bisa absen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <LocationCard
              key={loc.id}
              loc={loc}
              onEdit={(l) => setEditing(l)}
              onDelete={(l) => removeLocation(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

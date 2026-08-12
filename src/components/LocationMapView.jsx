import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const userIcon = L.divIcon({
  html: '<div style="background:#4f46e5;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const locIcon = L.divIcon({
  html: '<div style="background:#dc2626;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function FitBounds({ userLat, userLng, locLat, locLng }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds(
      [userLat, userLng],
      [locLat, locLng],
    )
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [userLat, userLng, locLat, locLng, map])
  return null
}

export default function LocationMapView({ userLat, userLng, locLat, locLng, radius, height = '220px' }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer
        center={[userLat, userLng]}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds userLat={userLat} userLng={userLng} locLat={locLat} locLng={locLng} />
        <Marker position={[userLat, userLng]} icon={userIcon}>
          <Popup>Lokasi kamu</Popup>
        </Marker>
        <Marker position={[locLat, locLng]} icon={locIcon}>
          <Popup>{locLat}, {locLng}</Popup>
        </Marker>
        <Circle center={[locLat, locLng]} radius={radius || 100} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.1, weight: 2 }} />
      </MapContainer>
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] shadow">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-600 shadow-sm" />
          <span>Kamu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600 shadow-sm" />
          <span>Lokasi Absen</span>
        </div>
      </div>
    </div>
  )
}

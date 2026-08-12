import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [locations, setLocations] = useState([])
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) {
      setLocations([])
      return
    }
    let cancelled = false
    api('/locations')
      .then((res) => {
        if (!cancelled) setLocations(res.locations || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentUser])

  const addLocation = useCallback(async (loc) => {
    try {
      const res = await api('/locations', {
        method: 'POST',
        body: { name: loc.name.trim(), lat: loc.lat, lng: loc.lng, radius: loc.radius || 100 },
      })
      const newLoc = res.location
      setLocations((prev) => {
        const next = [...(prev || []), newLoc]
        if (next.length > 4) return next.slice(-4)
        return next
      })
      return newLoc
    } catch (err) {
      return null
    }
  }, [])

  const updateLocation = useCallback(async (id, partial) => {
    try {
      const res = await api(`/locations/${id}`, { method: 'PUT', body: partial })
      setLocations((prev) => (prev || []).map((l) => (l.id === id ? res.location : l)))
    } catch (err) {
      // ignore
    }
  }, [])

  const removeLocation = useCallback(async (id) => {
    try {
      await api(`/locations/${id}`, { method: 'DELETE' })
      setLocations((prev) => (prev || []).filter((l) => l.id !== id))
    } catch (err) {
      // ignore
    }
  }, [])

  const value = useMemo(() => ({
    locations: locations || [],
    addLocation,
    updateLocation,
    removeLocation,
  }), [locations, addLocation, updateLocation, removeLocation])

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocations() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocations must be used within a LocationProvider')
  }
  return context
}

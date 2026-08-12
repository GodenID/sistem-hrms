import { useState, useEffect } from 'react'

function getStorageValue(key, defaultValue) {
  if (typeof window === 'undefined') {
    return defaultValue
  }
  try {
    const item = window.localStorage.getItem(key)
    if (item) {
      return JSON.parse(item)
    }
  } catch {
    // ignore parse errors
  }
  return defaultValue
}

export function useLocalStorage(key, defaultValue) {
  const [storedValue, setStoredValue] = useState(() => getStorageValue(key, defaultValue))

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue))
      }
    } catch {
      // ignore storage errors
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}

import { useCallback, useEffect, useState } from 'react'

export interface KeyLocation {
  id: string
  name: string
  lat: number
  lng: number
}

const STORAGE_KEY = 'wc-key-locations'

function load(): KeyLocation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Named places of interest (home, command post, ...), persisted locally since the
// app has no accounts. Dropped by clicking the map in "place" mode.
export function useKeyLocations() {
  const [locations, setLocations] = useState<KeyLocation[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations))
  }, [locations])

  const add = useCallback((lat: number, lng: number, name?: string) => {
    setLocations((ls) => [
      ...ls,
      { id: crypto.randomUUID(), name: name?.trim() || `Place ${ls.length + 1}`, lat, lng },
    ])
  }, [])

  const remove = useCallback((id: string) => {
    setLocations((ls) => ls.filter((l) => l.id !== id))
  }, [])

  return { locations, add, remove }
}

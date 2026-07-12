import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ALERT_RADIUS_KM, PLACE_COLORS, type SavedPlace } from '../domain/places'

const STORAGE_KEY = 'wc-key-locations'

function load(): SavedPlace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    // Migrate older entries that predate the alert fields.
    return parsed
      .map((p): SavedPlace => ({
        id: String(p.id ?? crypto.randomUUID()),
        name: String(p.name ?? 'Place'),
        lat: Number(p.lat),
        lng: Number(p.lng),
        color: typeof p.color === 'string' ? p.color : PLACE_COLORS[0]!,
        alertEnabled: Boolean(p.alertEnabled),
        alertRadiusKm: Number.isFinite(p.alertRadiusKm) ? Number(p.alertRadiusKm) : DEFAULT_ALERT_RADIUS_KM,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  } catch {
    return []
  }
}

// Named places of interest, persisted locally (no accounts). Each can opt into
// proximity alerts with its own radius.
export function useKeyLocations() {
  const [locations, setLocations] = useState<SavedPlace[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations))
  }, [locations])

  const add = useCallback((lat: number, lng: number, name?: string) => {
    setLocations((ls) => [
      ...ls,
      {
        id: crypto.randomUUID(),
        name: name?.trim() || `Place ${ls.length + 1}`,
        lat, lng,
        color: PLACE_COLORS[ls.length % PLACE_COLORS.length]!,
        alertEnabled: false,
        alertRadiusKm: DEFAULT_ALERT_RADIUS_KM,
      },
    ])
  }, [])

  const update = useCallback((id: string, patch: Partial<SavedPlace>) => {
    setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const remove = useCallback((id: string) => {
    setLocations((ls) => ls.filter((l) => l.id !== id))
  }, [])

  const clear = useCallback(() => setLocations([]), [])

  return { locations, add, update, remove, clear }
}

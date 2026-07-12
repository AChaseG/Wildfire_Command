import type { Fire } from './fire'
import { haversineKm } from './geo'

// A user-saved location. Persisted client-side (no accounts). Alert radius is
// stored in kilometres internally; the UI converts to the active unit system.
export interface SavedPlace {
  id: string
  name: string
  lat: number
  lng: number
  color: string
  alertEnabled: boolean
  alertRadiusKm: number
}

export const DEFAULT_ALERT_RADIUS_KM = 40 // ~25 mi

// New places cycle through these for variety; the user can recolor any place.
export const PLACE_COLORS = ['#5ad1c9', '#f0a020', '#7aa2ff', '#a78bfa', '#3fb950', '#f85149']

export interface PlaceProximity {
  place: SavedPlace
  fire: Fire
  distanceKm: number
}

// Active fires whose location falls within `radiusKm` of the place, nearest first.
export function firesWithinRadius(
  fires: readonly Fire[],
  place: Pick<SavedPlace, 'lat' | 'lng' | 'alertRadiusKm'>,
): { fire: Fire; distanceKm: number }[] {
  const out: { fire: Fire; distanceKm: number }[] = []
  for (const fire of fires) {
    if (fire.status === 'out') continue
    const distanceKm = haversineKm({ lat: place.lat, lng: place.lng }, fire.location)
    if (distanceKm <= place.alertRadiusKm) out.push({ fire, distanceKm })
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm)
}

// Every (alert-enabled place × active fire in range) pair. This is the set an
// alerting layer watches; a stable key per pair lets callers de-dupe so a fire
// is announced once, not on every data refresh.
export function detectProximities(
  fires: readonly Fire[],
  places: readonly SavedPlace[],
): PlaceProximity[] {
  const result: PlaceProximity[] = []
  for (const place of places) {
    if (!place.alertEnabled) continue
    for (const { fire, distanceKm } of firesWithinRadius(fires, place)) {
      result.push({ place, fire, distanceKm })
    }
  }
  return result
}

export function proximityKey(p: PlaceProximity): string {
  return `${p.place.id}:${p.fire.id}`
}

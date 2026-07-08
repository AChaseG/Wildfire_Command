// Core domain model. These types are the app's vocabulary; DB rows are mapped
// into them at the edge (see mappers.ts) so UI and logic never touch snake_case
// database shapes directly.

export type Severity = 'low' | 'moderate' | 'high' | 'extreme'
export type FireStatus = 'active' | 'contained' | 'controlled' | 'out'
export type FireUpdateKind =
  | 'containment'
  | 'evacuation'
  | 'weather'
  | 'air_quality'
  | 'crews'
  | 'general'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface Fire {
  id: string
  source: string
  externalId: string | null
  name: string
  cause: string | null
  severity: Severity
  status: FireStatus
  containmentPct: number
  acres: number
  discoveredAt: string
  endedAt: string | null
  location: GeoPoint & { description: string | null }
  weather: {
    windSpeedMph: number | null
    windDirectionDeg: number | null
    aqi: number | null
  }
  summary: string | null
  monitored: boolean
  updatedAt: string
}

export interface FireUpdate {
  id: string
  fireId: string
  postedAt: string
  kind: FireUpdateKind
  title: string
  body: string
}

export const STATUS_META: Record<FireStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#f85149' },
  contained: { label: 'Contained', color: '#f0a020' },
  controlled: { label: 'Controlled', color: '#3fb950' },
  out: { label: 'Out', color: '#6b7280' },
}

export function isActive(fire: Pick<Fire, 'status'>): boolean {
  return fire.status === 'active'
}

// Milliseconds the incident has been (or was) burning.
export function fireDurationMs(
  fire: Pick<Fire, 'discoveredAt' | 'endedAt'>,
  now: Date = new Date(),
): number {
  const start = Date.parse(fire.discoveredAt)
  if (Number.isNaN(start)) return 0
  const end = fire.endedAt ? Date.parse(fire.endedAt) : now.getTime()
  return Math.max(0, end - start)
}

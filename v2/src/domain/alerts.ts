import type { Fire } from './fire'
import { firesWithinRadius, type SavedPlace } from './places'
import { formatDistance, type UnitSystem } from './units'

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  fireId: string
  level: AlertLevel
  title: string
  detail: string
}

const DAY_MS = 86_400_000
const LEVEL_RANK: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }

// Derives notable conditions from the current incidents (no rules table needed):
// extreme fires with low containment, hazardous air, and brand-new incidents.
// Pure and deterministic given `now`, so it is straightforward to unit-test.
export function deriveAlerts(fires: readonly Fire[], now: Date = new Date()): Alert[] {
  const alerts: Alert[] = []

  for (const f of fires) {
    if (f.status === 'out') continue

    if (f.severity === 'extreme' && f.containmentPct < 25) {
      alerts.push({
        id: `${f.id}:extreme`, fireId: f.id, level: 'critical',
        title: `${f.name}: extreme fire at ${f.containmentPct}% containment`,
        detail: `${f.acres.toLocaleString()} acres in ${f.location.description ?? 'an unknown area'}.`,
      })
    }

    if (f.weather.aqi != null && f.weather.aqi >= 200) {
      alerts.push({
        id: `${f.id}:aqi`, fireId: f.id, level: 'critical',
        title: `${f.name}: hazardous air quality (AQI ${f.weather.aqi})`,
        detail: `Air quality near ${f.location.description ?? 'the incident'} is hazardous.`,
      })
    }

    const discovered = Date.parse(f.discoveredAt)
    if (f.status === 'active' && !Number.isNaN(discovered) && now.getTime() - discovered < DAY_MS) {
      const hours = Math.max(1, Math.round((now.getTime() - discovered) / 3_600_000))
      alerts.push({
        id: `${f.id}:new`, fireId: f.id, level: 'warning',
        title: `${f.name}: new incident`,
        detail: `First reported about ${hours}h ago.`,
      })
    }
  }

  return alerts.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

// Nearest saved place (within its alert radius) for each fire, by fire id.
function nearestPlaceByFire(
  fires: readonly Fire[],
  places: readonly SavedPlace[],
): Map<string, { place: SavedPlace; distanceKm: number }> {
  const byFire = new Map<string, { place: SavedPlace; distanceKm: number }>()
  for (const place of places) {
    for (const { fire, distanceKm } of firesWithinRadius(fires, place)) {
      const current = byFire.get(fire.id)
      if (!current || distanceKm < current.distanceKm) byFire.set(fire.id, { place, distanceKm })
    }
  }
  return byFire
}

// Alerts for the Alerts panel: restricted to fires that are either within a
// saved place's alert radius OR of extreme severity — nothing else. Fires near a
// place get a proximity alert; extreme fires and hazardous air are surfaced for
// the eligible set. With no saved places, this is just the extreme fires.
export function derivePlaceAlerts(
  fires: readonly Fire[],
  places: readonly SavedPlace[],
  units: UnitSystem = 'imperial',
): Alert[] {
  const near = nearestPlaceByFire(fires, places)
  const alerts: Alert[] = []

  for (const f of fires) {
    if (f.status === 'out') continue
    const proximity = near.get(f.id)
    const isExtreme = f.severity === 'extreme'
    if (!proximity && !isExtreme) continue // only proximity or extreme fires

    if (proximity) {
      alerts.push({
        id: `${f.id}:prox`, fireId: f.id, level: isExtreme ? 'critical' : 'warning',
        title: `${f.name}: ${formatDistance(proximity.distanceKm, units)} from ${proximity.place.name}`,
        detail: `${f.severity} severity, ${f.containmentPct}% contained.`,
      })
    }
    if (isExtreme) {
      alerts.push({
        id: `${f.id}:extreme`, fireId: f.id, level: 'critical',
        title: `${f.name}: extreme fire at ${f.containmentPct}% containment`,
        detail: `${f.acres.toLocaleString()} acres in ${f.location.description ?? 'an unknown area'}.`,
      })
    }
    if (f.weather.aqi != null && f.weather.aqi >= 200) {
      alerts.push({
        id: `${f.id}:aqi`, fireId: f.id, level: 'critical',
        title: `${f.name}: hazardous air quality (AQI ${f.weather.aqi})`,
        detail: `Air quality near ${f.location.description ?? 'the incident'} is hazardous.`,
      })
    }
  }

  return alerts.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

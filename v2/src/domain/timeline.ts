// A best-effort incident timeline derived purely from a fire's own dated fields.
// The ingested backend keeps a real change log (see fire_updates); without it —
// e.g. backend-less "live" mode — this surfaces the milestones the point-in-time
// WFIGS snapshot still carries (discovery, current size/containment, resolution)
// so the Updates tab shows real, incident-specific history instead of nothing.

import type { Fire, FireUpdate } from './fire'
import { formatArea, formatWind, type UnitSystem } from './units'

export function deriveFireTimeline(fire: Fire, units: UnitSystem): FireUpdate[] {
  const updates: FireUpdate[] = []
  const add = (key: string, postedAt: string | null, kind: FireUpdate['kind'], title: string, body = '') => {
    if (!postedAt || Number.isNaN(Date.parse(postedAt))) return
    updates.push({ id: `${fire.id}:${key}`, fireId: fire.id, postedAt, kind, title, body })
  }

  // Latest snapshot: size + containment.
  add(
    'status', fire.updatedAt, 'containment',
    `${formatArea(fire.acres, units)} · ${fire.containmentPct}% contained`,
    `Reported ${fire.status}, ${fire.severity} severity.`,
  )

  // Enrichment, when a backend supplied it.
  if (fire.weather.windSpeedMph != null || fire.weather.windDirectionDeg != null) {
    add('weather', fire.updatedAt, 'weather', `Wind ${formatWind(fire.weather.windSpeedMph, fire.weather.windDirectionDeg, units)}`)
  }
  if (fire.weather.aqi != null) {
    add('aqi', fire.updatedAt, 'air_quality', `Air quality index ${fire.weather.aqi}`)
  }

  // Resolution milestone.
  if (fire.endedAt) {
    const label =
      fire.status === 'out' ? 'Fire declared out'
      : fire.status === 'controlled' ? 'Fire controlled'
      : fire.status === 'contained' ? 'Fire contained'
      : 'Incident resolved'
    add('ended', fire.endedAt, 'general', label)
  }

  // Discovery — the start of the incident.
  add(
    'discovery', fire.discoveredAt, 'general', 'Fire discovered',
    [fire.location.description, fire.cause ? `Cause: ${fire.cause}` : null].filter(Boolean).join(' · '),
  )

  return updates.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
}

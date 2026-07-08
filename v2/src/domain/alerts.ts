import type { Fire } from './fire'

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

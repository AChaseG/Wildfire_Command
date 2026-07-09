import { wfigsConnector } from '../../supabase/functions/_shared/connectors/wfigs'
import type { Fire } from '../domain'

// Browser-direct incident source: fetches NIFC WFIGS straight from the public
// ArcGIS feature service (which sends permissive CORS headers) and reuses the
// connector's pure parser. This lets the app run with live data and NO backend
// at all — the same parseWfigs the edge function uses, running in the browser.
export async function fetchLiveFires(): Promise<Fire[]> {
  const rows = await wfigsConnector.fetch()
  return rows.map((r, i) => ({
    id: r.external_id || `wfigs-${i}`,
    source: r.source,
    externalId: r.external_id,
    name: r.name,
    cause: r.cause,
    severity: r.severity,
    status: r.status,
    containmentPct: r.containment_pct,
    acres: r.acres,
    discoveredAt: r.discovered_at,
    endedAt: r.ended_at,
    location: { lat: r.latitude, lng: r.longitude, description: r.location_description },
    weather: { windSpeedMph: r.wind_speed_mph, windDirectionDeg: r.wind_direction_deg, aqi: r.aqi },
    summary: r.summary,
    monitored: false,
    updatedAt: r.updated_at,
  }))
}

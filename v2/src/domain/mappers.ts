import type { Fire, FireStatus, FireUpdate, FireUpdateKind, Severity } from './fire'
import type { Hotspot } from './hotspot'
import type { FireRow, FireUpdateRow, HotspotRow } from '../types/database'

export function fireFromRow(row: FireRow): Fire {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    name: row.name,
    cause: row.cause,
    severity: row.severity as Severity,
    status: row.status as FireStatus,
    containmentPct: row.containment_pct,
    acres: row.acres,
    discoveredAt: row.discovered_at,
    endedAt: row.ended_at,
    location: {
      lat: row.latitude,
      lng: row.longitude,
      description: row.location_description,
    },
    weather: {
      windSpeedMph: row.wind_speed_mph,
      windDirectionDeg: row.wind_direction_deg,
      aqi: row.aqi,
    },
    summary: row.summary,
    monitored: row.monitored,
    updatedAt: row.updated_at,
  }
}

export function hotspotFromRow(row: HotspotRow): Hotspot {
  return {
    id: row.id,
    lat: row.latitude,
    lng: row.longitude,
    brightnessK: row.brightness_k,
    frp: row.frp,
    confidence: row.confidence,
    detectedAt: row.detected_at,
    satellite: row.satellite,
  }
}

export function fireUpdateFromRow(row: FireUpdateRow): FireUpdate {
  return {
    id: row.id,
    fireId: row.fire_id,
    postedAt: row.posted_at,
    kind: row.kind as FireUpdateKind,
    title: row.title,
    body: row.body,
  }
}

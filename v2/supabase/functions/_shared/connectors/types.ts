// A connector fetches from one external source and returns rows ready to upsert
// into `fires`. Connectors target fixed, trusted endpoints (no caller-supplied
// URLs), so there is no SSRF surface to guard — unlike v1's scrape functions.

export type Severity = 'low' | 'moderate' | 'high' | 'extreme'
export type FireStatus = 'active' | 'contained' | 'controlled' | 'out'

export interface FireUpsert {
  source: string
  external_id: string
  name: string
  cause: string | null
  severity: Severity
  status: FireStatus
  containment_pct: number
  acres: number
  discovered_at: string
  ended_at: string | null
  latitude: number
  longitude: number
  location_description: string | null
  wind_speed_mph: number | null
  wind_direction_deg: number | null
  aqi: number | null
  summary: string | null
  updated_at: string
}

export interface Connector {
  readonly name: string
  fetch(): Promise<FireUpsert[]>
}

// Satellite thermal detections upserted into the `hotspots` table.
export interface HotspotUpsert {
  source: string
  latitude: number
  longitude: number
  brightness_k: number | null
  confidence: string | null
  frp: number | null
  detected_at: string
  satellite: string | null
}

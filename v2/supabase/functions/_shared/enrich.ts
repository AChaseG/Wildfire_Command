// Enrichment helpers used by the orchestrator after fires are upserted: wind
// (Open-Meteo, keyless) and AQI (PurpleAir, needs a key). The pure mapping logic
// lives here and is unit-tested; the orchestrator supplies the fetched payloads.

export interface Wind {
  windSpeedMph: number | null
  windDirectionDeg: number | null
}

// Open-Meteo `current` block (wind requested in mph) -> our fields.
export function windFromMeteo(current: { wind_speed_10m?: unknown; wind_direction_10m?: unknown } | null | undefined): Wind {
  const speed = Number(current?.wind_speed_10m)
  const dir = Number(current?.wind_direction_10m)
  return {
    windSpeedMph: Number.isFinite(speed) ? Math.round(speed) : null,
    windDirectionDeg: Number.isFinite(dir) ? Math.round(dir) : null,
  }
}

// US EPA PM2.5 -> AQI (µg/m³ to index), linear within each breakpoint band.
const PM_BREAKPOINTS: readonly [number, number, number, number][] = [
  [0, 12, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 500.4, 301, 500],
]

export function pm25ToAqi(pm: number): number {
  const c = Math.max(0, Math.min(pm, 500.4))
  for (const [cLow, cHigh, iLow, iHigh] of PM_BREAKPOINTS) {
    if (c >= cLow && c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow)
    }
  }
  return 500
}

export interface Sensor {
  lat: number
  lng: number
  aqi: number
}

const EARTH_RADIUS_KM = 6371
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// AQI of the nearest sensor within `maxKm`, or null when none is close enough.
export function nearestAqi(
  point: { lat: number; lng: number },
  sensors: readonly Sensor[],
  maxKm = 40,
): number | null {
  let best: number | null = null
  let bestDist = Infinity
  for (const s of sensors) {
    const d = haversineKm(point.lat, point.lng, s.lat, s.lng)
    if (d < bestDist && d <= maxKm) {
      bestDist = d
      best = Math.round(s.aqi)
    }
  }
  return best
}

// Browser-direct weather/air-quality enrichment for live mode. The backend
// fills wind (Open-Meteo) and AQI (PurpleAir, key-gated) after ingest; with no
// backend those stay null. Open-Meteo's forecast and air-quality APIs are both
// keyless and CORS-enabled and accept many coordinates per request, so we can
// enrich every incident straight from the browser in a handful of calls.

import { windFromMeteo } from '../../supabase/functions/_shared/enrich'
import type { Fire } from '../domain'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const BATCH = 100
const TIMEOUT_MS = 8000

export interface MeteoCurrent { wind_speed_10m?: unknown; wind_direction_10m?: unknown }
export interface AirCurrent { us_aqi?: unknown }

// Pure: merge fetched wind + AQI onto a fire, keeping any existing value when a
// source didn't return a usable number. Exported for unit testing.
export function mergeWeather(fire: Fire, wind: MeteoCurrent | undefined, air: AirCurrent | undefined): Fire {
  const w = windFromMeteo(wind)
  // Guard null/undefined before Number(): Number(null) is 0, which would
  // clobber an existing AQI with a bogus zero.
  const rawAqi = air?.us_aqi
  const aqiNum = rawAqi == null ? NaN : Number(rawAqi)
  return {
    ...fire,
    weather: {
      windSpeedMph: w.windSpeedMph ?? fire.weather.windSpeedMph,
      windDirectionDeg: w.windDirectionDeg ?? fire.weather.windDirectionDeg,
      aqi: Number.isFinite(aqiNum) ? Math.round(aqiNum) : fire.weather.aqi,
    },
  }
}

// Open-Meteo returns an object for a single coordinate and an array for many;
// normalize to an array aligned with the coordinates we sent.
async function fetchCurrents(url: string, signal: AbortSignal): Promise<{ current?: unknown }[]> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

// Enrich fires with wind + AQI. Best-effort: on any failure or timeout the
// fires are returned unenriched rather than breaking the incident list.
export async function enrichFiresWithWeather(fires: Fire[]): Promise<Fire[]> {
  if (fires.length === 0 || typeof fetch === 'undefined') return fires
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const out = fires.slice()
    for (let i = 0; i < fires.length; i += BATCH) {
      const chunk = fires.slice(i, i + BATCH)
      const lats = chunk.map((f) => f.location.lat.toFixed(4)).join(',')
      const lngs = chunk.map((f) => f.location.lng.toFixed(4)).join(',')
      const windUrl = `${FORECAST_URL}?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`
      const airUrl = `${AIR_URL}?latitude=${lats}&longitude=${lngs}&current=us_aqi`
      // Each endpoint fails independently; a miss just leaves that field null.
      const [wind, air] = await Promise.all([
        fetchCurrents(windUrl, controller.signal).catch(() => [] as { current?: unknown }[]),
        fetchCurrents(airUrl, controller.signal).catch(() => [] as { current?: unknown }[]),
      ])
      chunk.forEach((f, j) => {
        out[i + j] = mergeWeather(f, wind[j]?.current as MeteoCurrent | undefined, air[j]?.current as AirCurrent | undefined)
      })
    }
    return out
  } catch {
    return fires
  } finally {
    clearTimeout(timer)
  }
}

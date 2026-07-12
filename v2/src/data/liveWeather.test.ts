import { describe, it, expect } from 'vitest'
import { mergeWeather } from './liveWeather'
import type { Fire } from '../domain'

const fire = (weather: Fire['weather']): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'x', name: 'F', cause: null,
  severity: 'high', status: 'active', containmentPct: 0, acres: 1,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34, lng: -118, description: null },
  weather, summary: null, monitored: false, updatedAt: '2026-07-01T00:00:00Z',
})

const empty = { windSpeedMph: null, windDirectionDeg: null, aqi: null }

describe('mergeWeather', () => {
  it('fills wind and AQI from the fetched currents', () => {
    const merged = mergeWeather(fire(empty), { wind_speed_10m: 12.6, wind_direction_10m: 270 }, { us_aqi: 148.2 })
    expect(merged.weather).toEqual({ windSpeedMph: 13, windDirectionDeg: 270, aqi: 148 })
  })

  it('keeps existing values when a source is missing or unusable', () => {
    const seeded = fire({ windSpeedMph: 5, windDirectionDeg: 90, aqi: 42 })
    expect(mergeWeather(seeded, undefined, undefined).weather).toEqual({ windSpeedMph: 5, windDirectionDeg: 90, aqi: 42 })
    expect(mergeWeather(seeded, { wind_speed_10m: 'n/a' }, { us_aqi: null }).weather).toEqual({ windSpeedMph: 5, windDirectionDeg: 90, aqi: 42 })
  })

  it('does not mutate the input fire', () => {
    const original = fire(empty)
    mergeWeather(original, { wind_speed_10m: 10, wind_direction_10m: 10 }, { us_aqi: 10 })
    expect(original.weather).toEqual(empty)
  })
})

import { describe, it, expect } from 'vitest'
import { windFromMeteo, nearestAqi, pm25ToAqi } from './enrich'

describe('windFromMeteo', () => {
  it('rounds speed and direction', () => {
    expect(windFromMeteo({ wind_speed_10m: 12.4, wind_direction_10m: 224.6 })).toEqual({
      windSpeedMph: 12,
      windDirectionDeg: 225,
    })
  })

  it('returns nulls for missing/invalid data', () => {
    expect(windFromMeteo(null)).toEqual({ windSpeedMph: null, windDirectionDeg: null })
    expect(windFromMeteo({})).toEqual({ windSpeedMph: null, windDirectionDeg: null })
  })
})

describe('pm25ToAqi', () => {
  it('maps EPA breakpoints', () => {
    expect(pm25ToAqi(0)).toBe(0)
    expect(pm25ToAqi(12)).toBe(50)
    expect(pm25ToAqi(35.4)).toBe(100)
    expect(pm25ToAqi(55.4)).toBe(150)
    expect(pm25ToAqi(250.4)).toBe(300)
  })

  it('clamps very high concentrations', () => {
    expect(pm25ToAqi(9999)).toBe(500)
  })
})

describe('nearestAqi', () => {
  const sensors = [
    { lat: 34.05, lng: -118.24, aqi: 90 }, // ~downtown LA
    { lat: 40.71, lng: -74.0, aqi: 20 }, // NYC, far away
  ]

  it('picks the nearest sensor within range', () => {
    expect(nearestAqi({ lat: 34.06, lng: -118.25 }, sensors)).toBe(90)
  })

  it('returns null when no sensor is within range', () => {
    expect(nearestAqi({ lat: 47.6, lng: -122.3 }, sensors, 40)).toBeNull()
  })
})

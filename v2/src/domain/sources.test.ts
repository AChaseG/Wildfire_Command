import { describe, it, expect } from 'vitest'
import { fireSources } from './sources'
import type { Fire } from './fire'

const fire = (o: Partial<Fire> = {}): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'ABC-123', name: 'Test Fire', cause: null,
  severity: 'high', status: 'active', containmentPct: 0, acres: 100,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34.05, lng: -118.24, description: null },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-01T00:00:00Z', ...o,
})

describe('fireSources', () => {
  it('always includes the WFIGS record, linked by IrwinID', () => {
    const [core, ...rest] = fireSources(fire())
    expect(core.name).toBe('NIFC WFIGS')
    expect(core.url).toContain("IrwinID%3D'ABC-123'")
    expect(rest).toHaveLength(0)
  })

  it('falls back to the NIFC portal when there is no external id', () => {
    const [core] = fireSources(fire({ externalId: null }))
    expect(core.url).toBe('https://data-nifc.opendata.arcgis.com/')
  })

  it('adds Open-Meteo only when wind is present', () => {
    const src = fireSources(fire({ weather: { windSpeedMph: 12, windDirectionDeg: 270, aqi: null } }))
    const wind = src.find((s) => s.name === 'Open-Meteo')
    expect(wind).toBeDefined()
    expect(wind!.url).toContain('latitude=34.0500')
  })

  it('adds PurpleAir only when AQI is present', () => {
    expect(fireSources(fire()).some((s) => s.name === 'PurpleAir')).toBe(false)
    const src = fireSources(fire({ weather: { windSpeedMph: null, windDirectionDeg: null, aqi: 152 } }))
    expect(src.some((s) => s.name === 'PurpleAir')).toBe(true)
  })
})

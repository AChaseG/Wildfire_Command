import { describe, it, expect } from 'vitest'
import { broadcastifyListenUrl, fireSources } from './sources'
import type { Fire } from './fire'

const fire = (o: Partial<Fire> = {}): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'ABC-123', name: 'Test Fire', cause: null,
  severity: 'high', status: 'active', containmentPct: 0, acres: 100,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34.05, lng: -118.24, description: null },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-01T00:00:00Z', ...o,
})

const names = (f: Fire) => fireSources(f).map((s) => s.name)

describe('fireSources', () => {
  it('always includes the WFIGS record, linked by IrwinID', () => {
    const core = fireSources(fire())[0]
    expect(core.name).toBe('NIFC WFIGS')
    expect(core.kind).toBe('data')
    expect(core.url).toContain("IrwinID%3D'ABC-123'")
  })

  it('falls back to the NIFC portal when there is no external id', () => {
    const core = fireSources(fire({ externalId: null }))[0]
    expect(core.url).toBe('https://data-nifc.opendata.arcgis.com/')
  })

  it('adds Open-Meteo only when wind is present', () => {
    expect(names(fire())).not.toContain('Open-Meteo')
    const wind = fireSources(fire({ weather: { windSpeedMph: 12, windDirectionDeg: 270, aqi: null } }))
      .find((s) => s.name === 'Open-Meteo')
    expect(wind).toBeDefined()
    expect(wind!.url).toContain('latitude=34.0500')
  })

  it('adds the air-quality source only when AQI is present, attributed by mode', () => {
    expect(names(fire())).not.toContain('Open-Meteo Air Quality')
    const withAqi = fire({ weather: { windSpeedMph: null, windDirectionDeg: null, aqi: 152 } })
    expect(fireSources(withAqi).map((s) => s.name)).toContain('Open-Meteo Air Quality')
    expect(fireSources(withAqi, { aqiFromBackend: true }).map((s) => s.name)).toContain('PurpleAir')
  })

  it('always includes reference sources (WildCAD, Broadcastify, InciWeb, FIRMS)', () => {
    const refs = fireSources(fire()).filter((s) => s.kind === 'reference')
    expect(refs.map((s) => s.name)).toEqual(['WildCAD · WildWeb', 'Broadcastify scanner', 'InciWeb', 'NASA FIRMS'])
  })

  it('links Broadcastify to the incident state (FIPS stid), or nationally when unknown', () => {
    expect(broadcastifyListenUrl('Los Angeles County, CA')).toBe('https://www.broadcastify.com/listen/?stid=6')
    expect(broadcastifyListenUrl('Deschutes County, OR')).toBe('https://www.broadcastify.com/listen/?stid=41')
    expect(broadcastifyListenUrl(null)).toBe('https://www.broadcastify.com/listen/')
    expect(broadcastifyListenUrl('Somewhere unknown')).toBe('https://www.broadcastify.com/listen/')
  })

  it('deep-links the FIRMS map to the incident coordinates', () => {
    const firms = fireSources(fire()).find((s) => s.name === 'NASA FIRMS')!
    expect(firms.url).toContain('@-118.2400,34.0500,9z')
  })
})

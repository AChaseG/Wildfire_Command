import { describe, it, expect } from 'vitest'
import { deriveFireTimeline } from './timeline'
import type { Fire } from './fire'

const fire = (o: Partial<Fire> = {}): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'ABC', name: 'Test Fire', cause: 'Lightning',
  severity: 'high', status: 'active', containmentPct: 40, acres: 1200,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34.05, lng: -118.24, description: 'Los Angeles County, CA' },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-05T12:00:00Z', ...o,
})

describe('deriveFireTimeline', () => {
  it('always yields a discovery and a current-status entry, newest first', () => {
    const t = deriveFireTimeline(fire(), 'imperial')
    expect(t.map((u) => u.id)).toEqual(['f:status', 'f:discovery'])
    expect(t[0].title).toContain('1,200 ac')
    expect(t[0].title).toContain('40% contained')
    expect(t[t.length - 1].title).toBe('Fire discovered')
    expect(t[t.length - 1].body).toContain('Cause: Lightning')
  })

  it('formats size with the chosen unit system', () => {
    const t = deriveFireTimeline(fire(), 'metric')
    expect(t[0].title).toContain('ha')
    expect(t[0].title).not.toContain('ac ')
  })

  it('adds a resolution milestone when the fire has ended', () => {
    const t = deriveFireTimeline(fire({ status: 'out', endedAt: '2026-07-10T00:00:00Z', containmentPct: 100 }), 'imperial')
    const ended = t.find((u) => u.id === 'f:ended')
    expect(ended).toBeDefined()
    expect(ended!.title).toBe('Fire declared out')
    // ended is more recent than the status snapshot, so it sorts first
    expect(t[0].id).toBe('f:ended')
  })

  it('includes weather and AQI entries only when present', () => {
    expect(deriveFireTimeline(fire(), 'imperial').some((u) => u.kind === 'weather')).toBe(false)
    const t = deriveFireTimeline(fire({ weather: { windSpeedMph: 12, windDirectionDeg: 270, aqi: 150 } }), 'imperial')
    expect(t.some((u) => u.id === 'f:weather')).toBe(true)
    expect(t.some((u) => u.id === 'f:aqi')).toBe(true)
  })

  it('skips entries with unparseable dates', () => {
    const t = deriveFireTimeline(fire({ discoveredAt: 'not-a-date' }), 'imperial')
    expect(t.some((u) => u.id === 'f:discovery')).toBe(false)
  })
})

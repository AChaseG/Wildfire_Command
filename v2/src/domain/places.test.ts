import { describe, it, expect } from 'vitest'
import { firesWithinRadius, detectProximities, proximityKey, type SavedPlace } from './places'
import type { Fire } from './fire'

const fire = (id: string, lat: number, lng: number, status: Fire['status'] = 'active'): Fire => ({
  id, source: 's', externalId: null, name: `Fire ${id}`, cause: null,
  severity: 'high', status, containmentPct: 0, acres: 100,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat, lng, description: null },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-01T00:00:00Z',
})

const place = (o: Partial<SavedPlace>): SavedPlace => ({
  id: 'p', name: 'Home', lat: 34.05, lng: -118.24, color: '#5ad1c9', alertEnabled: true, alertRadiusKm: 40, ...o,
})

describe('firesWithinRadius', () => {
  it('includes fires inside the radius and excludes far ones', () => {
    const near = fire('near', 34.1, -118.2) // ~7 km from downtown LA
    const far = fire('far', 37.77, -122.42) // SF, ~560 km
    const hits = firesWithinRadius([near, far], place({ alertRadiusKm: 40 }))
    expect(hits.map((h) => h.fire.id)).toEqual(['near'])
  })

  it('sorts by distance ascending', () => {
    const a = fire('a', 34.3, -118.24) // ~28 km
    const b = fire('b', 34.1, -118.24) // ~6 km
    const hits = firesWithinRadius([a, b], place({ alertRadiusKm: 60 }))
    expect(hits.map((h) => h.fire.id)).toEqual(['b', 'a'])
  })

  it('ignores fires that are out', () => {
    const out = fire('out', 34.06, -118.24, 'out')
    expect(firesWithinRadius([out], place({}))).toHaveLength(0)
  })
})

describe('detectProximities', () => {
  it('only considers alert-enabled places', () => {
    const f = fire('f', 34.06, -118.24)
    const on = place({ id: 'on', alertEnabled: true })
    const off = place({ id: 'off', alertEnabled: false })
    const hits = detectProximities([f], [on, off])
    expect(hits.map((h) => h.place.id)).toEqual(['on'])
    expect(proximityKey(hits[0]!)).toBe('on:f')
  })
})

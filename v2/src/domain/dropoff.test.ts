import { describe, it, expect } from 'vitest'
import { applyDropOff, isStaleActive } from './dropoff'
import type { Fire } from './fire'

const now = new Date('2026-07-14T00:00:00Z')

const fire = (o: Partial<Fire> = {}): Fire => ({
  id: 'f', source: 's', externalId: null, name: 'F', cause: null,
  severity: 'high', status: 'active', containmentPct: 0, acres: 100,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 0, lng: 0, description: null },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-13T00:00:00Z', ...o,
})

describe('isStaleActive', () => {
  it('is false when drop-off is disabled', () => {
    expect(isStaleActive(fire({ updatedAt: '2026-01-01T00:00:00Z' }), 0, now)).toBe(false)
  })

  it('flags an active fire not updated within the window', () => {
    // last update 5 days ago, window 3 days → stale
    expect(isStaleActive(fire({ updatedAt: '2026-07-09T00:00:00Z' }), 72, now)).toBe(true)
    // last update 1 day ago, window 3 days → fresh
    expect(isStaleActive(fire({ updatedAt: '2026-07-13T00:00:00Z' }), 72, now)).toBe(false)
  })

  it('never drops contained or out fires, however stale', () => {
    expect(isStaleActive(fire({ status: 'contained', updatedAt: '2026-01-01T00:00:00Z' }), 72, now)).toBe(false)
    expect(isStaleActive(fire({ status: 'out', updatedAt: '2026-01-01T00:00:00Z' }), 72, now)).toBe(false)
  })

  it('keeps a fire whose update time is unknown', () => {
    expect(isStaleActive(fire({ updatedAt: 'not-a-date' }), 72, now)).toBe(false)
  })
})

describe('applyDropOff', () => {
  it('returns everything when disabled', () => {
    const fires = [fire({ id: 'a', updatedAt: '2026-01-01T00:00:00Z' })]
    expect(applyDropOff(fires, 0, now)).toHaveLength(1)
  })

  it('removes only the stale active fires', () => {
    const fires = [
      fire({ id: 'fresh', updatedAt: '2026-07-13T12:00:00Z' }),
      fire({ id: 'stale', updatedAt: '2026-07-05T00:00:00Z' }),
      fire({ id: 'stale-but-contained', status: 'contained', updatedAt: '2026-06-01T00:00:00Z' }),
    ]
    expect(applyDropOff(fires, 72, now).map((f) => f.id)).toEqual(['fresh', 'stale-but-contained'])
  })
})

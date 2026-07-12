import { describe, it, expect } from 'vitest'
import { changeToUpdate, diffSnapshot, snapshotDiffers, snapshotOf, type FireSnapshot } from './history'
import type { Fire } from './fire'

const fire = (o: Partial<Fire> = {}): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'ABC', name: 'Test Fire', cause: null,
  severity: 'high', status: 'active', containmentPct: 20, acres: 1000,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34, lng: -118, description: null },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-05T00:00:00Z', ...o,
})

const snap = (o: Partial<FireSnapshot> = {}): FireSnapshot => ({
  containmentPct: 20, acres: 1000, status: 'active', severity: 'high', observedAt: '2026-07-05T00:00:00Z', ...o,
})

describe('diffSnapshot', () => {
  it('detects containment, status, and severity changes', () => {
    const changes = diffSnapshot(snap(), snap({ containmentPct: 40, status: 'contained', severity: 'extreme' }))
    expect(changes.map((c) => c.field).sort()).toEqual(['containment', 'severity', 'status'])
    expect(changes.find((c) => c.field === 'containment')).toMatchObject({ from: 20, to: 40 })
  })

  it('records a significant size change but ignores jitter', () => {
    // +5 acres on a 1000-acre fire: below both floors → ignored.
    expect(diffSnapshot(snap(), snap({ acres: 1005 })).some((c) => c.field === 'size')).toBe(false)
    // +200 acres: clears absolute and relative floors → recorded.
    const grown = diffSnapshot(snap(), snap({ acres: 1200 }))
    expect(grown.find((c) => c.field === 'size')).toMatchObject({ from: 1000, to: 1200 })
  })

  it('returns nothing when nothing meaningful changed', () => {
    expect(diffSnapshot(snap(), snap({ acres: 1005, observedAt: '2026-07-06T00:00:00Z' }))).toEqual([])
    expect(snapshotDiffers(snap(), snap({ acres: 1005 }))).toBe(false)
  })

  it('timestamps changes at the newer snapshot', () => {
    const changes = diffSnapshot(snap(), snap({ containmentPct: 55, observedAt: '2026-07-09T10:00:00Z' }))
    expect(changes[0].observedAt).toBe('2026-07-09T10:00:00Z')
  })
})

describe('snapshotOf', () => {
  it('captures the tracked fields', () => {
    expect(snapshotOf(fire({ containmentPct: 33 }), '2026-07-07T00:00:00Z')).toEqual({
      containmentPct: 33, acres: 1000, status: 'active', severity: 'high', observedAt: '2026-07-07T00:00:00Z',
    })
  })
})

describe('changeToUpdate', () => {
  it('phrases containment direction and keeps a stable id', () => {
    const up = changeToUpdate({ observedAt: '2026-07-09T00:00:00Z', field: 'containment', from: 20, to: 40 }, 'f', 'imperial')
    expect(up.title).toBe('Containment increased to 40%')
    expect(up.kind).toBe('containment')
    expect(up.id).toBe('f:obs:2026-07-09T00:00:00Z:containment')
    const down = changeToUpdate({ observedAt: 'x', field: 'containment', from: 40, to: 30 }, 'f', 'imperial')
    expect(down.title).toBe('Containment decreased to 30%')
  })

  it('formats a size change in the active units', () => {
    expect(changeToUpdate({ observedAt: 'x', field: 'size', from: 1000, to: 1200 }, 'f', 'imperial').title).toBe('Grew to 1,200 ac')
    expect(changeToUpdate({ observedAt: 'x', field: 'size', from: 1000, to: 1200 }, 'f', 'metric').title).toContain('ha')
  })

  it('phrases status and severity changes', () => {
    expect(changeToUpdate({ observedAt: 'x', field: 'status', from: 'active', to: 'contained' }, 'f', 'imperial').title).toBe('Status changed to contained')
    expect(changeToUpdate({ observedAt: 'x', field: 'severity', from: 'high', to: 'extreme' }, 'f', 'imperial').title).toBe('Severity changed to extreme')
  })
})

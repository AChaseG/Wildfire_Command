import { describe, it, expect } from 'vitest'
import { haversineKm, boundsFromPoints, isWithinBounds } from './geo'

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm({ lat: 34, lng: -118 }, { lat: 34, lng: -118 })).toBeCloseTo(0, 5)
  })

  it('matches a known distance (LA to SF ≈ 559 km)', () => {
    const d = haversineKm({ lat: 34.0522, lng: -118.2437 }, { lat: 37.7749, lng: -122.4194 })
    expect(d).toBeGreaterThan(540)
    expect(d).toBeLessThan(575)
  })
})

describe('bounds', () => {
  it('computes an enclosing box and membership', () => {
    const b = boundsFromPoints([{ lat: 0, lng: 0 }, { lat: 10, lng: 20 }])
    expect(b).toEqual({ south: 0, west: 0, north: 10, east: 20 })
    expect(isWithinBounds({ lat: 5, lng: 10 }, b!)).toBe(true)
    expect(isWithinBounds({ lat: 5, lng: 30 }, b!)).toBe(false)
  })

  it('returns null for an empty set', () => {
    expect(boundsFromPoints([])).toBeNull()
  })
})

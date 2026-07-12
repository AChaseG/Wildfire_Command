import { describe, it, expect } from 'vitest'
import { isInViewport, itemsInViewport, type Bounds } from './geo'

const conus: Bounds = { south: 32, north: 42, west: -125, east: -114 } // California-ish box

describe('isInViewport', () => {
  it('includes points inside and excludes points outside', () => {
    expect(isInViewport({ lat: 34.05, lng: -118.24 }, conus)).toBe(true) // LA
    expect(isInViewport({ lat: 40.7, lng: -74 }, conus)).toBe(false) // NYC (east of box)
    expect(isInViewport({ lat: 47.6, lng: -122.3 }, conus)).toBe(false) // Seattle (north of box)
  })

  it('handles a viewport that wraps the antimeridian (west > east)', () => {
    const pacific: Bounds = { south: 50, north: 60, west: 170, east: -170 }
    expect(isInViewport({ lat: 52, lng: 179 }, pacific)).toBe(true)
    expect(isInViewport({ lat: 52, lng: -179 }, pacific)).toBe(true)
    expect(isInViewport({ lat: 52, lng: 0 }, pacific)).toBe(false)
  })
})

describe('itemsInViewport', () => {
  it('returns only items whose location is inside the bounds', () => {
    const items = [
      { id: 'la', location: { lat: 34.05, lng: -118.24 } },
      { id: 'ny', location: { lat: 40.7, lng: -74 } },
      { id: 'sf', location: { lat: 37.77, lng: -122.42 } },
    ]
    expect(itemsInViewport(items, conus).map((i) => i.id)).toEqual(['la', 'sf'])
  })
})

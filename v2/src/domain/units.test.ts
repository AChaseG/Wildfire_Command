import { describe, it, expect } from 'vitest'
import { degToCompass, formatArea, formatDistance, formatWind, acresToHectares } from './units'

describe('degToCompass', () => {
  it('maps cardinal degrees to the 16-point compass', () => {
    expect(degToCompass(0)).toBe('N')
    expect(degToCompass(90)).toBe('E')
    expect(degToCompass(180)).toBe('S')
    expect(degToCompass(270)).toBe('W')
    expect(degToCompass(360)).toBe('N')
  })

  it('normalizes negative and out-of-range degrees', () => {
    expect(degToCompass(-90)).toBe('W')
    expect(degToCompass(450)).toBe('E')
  })
})

describe('formatting', () => {
  it('formats area per unit system', () => {
    expect(formatArea(1_000, 'imperial')).toBe('1,000 ac')
    expect(formatArea(1_000, 'metric')).toBe(`${Math.round(acresToHectares(1_000)).toLocaleString('en-US')} ha`)
  })

  it('formats distance per unit system', () => {
    expect(formatDistance(1.609_344, 'imperial')).toBe('1.0 mi')
    expect(formatDistance(5, 'metric')).toBe('5.0 km')
    expect(formatDistance(100, 'metric')).toBe('100 km')
  })

  it('formats wind and handles missing data', () => {
    expect(formatWind(null, null, 'imperial')).toBe('—')
    expect(formatWind(10, 0, 'imperial')).toBe('10 mph N')
    expect(formatWind(10, null, 'imperial')).toBe('10 mph')
  })
})

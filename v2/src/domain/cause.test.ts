import { describe, it, expect } from 'vitest'
import { classifyCause, causeCategoryLabel, isArson } from './cause'

describe('classifyCause', () => {
  it('flags arson / incendiary', () => {
    expect(classifyCause('Arson/Incendiary')).toBe('arson')
    expect(classifyCause('Incendiary')).toBe('arson')
    expect(classifyCause('Human - Arson')).toBe('arson')
  })

  it('classifies accidental human causes', () => {
    for (const c of [
      'Debris and Open Burning', 'Equipment and Vehicle Use', 'Campfire',
      'Smoking', 'Powerline', 'Railroad Operations and Maintenance',
      'Fireworks', 'Misuse of Fire by a Minor', 'Power Generation/Transmission/Distribution',
    ]) {
      expect(classifyCause(c)).toBe('accidental')
    }
  })

  it('classifies natural causes', () => {
    expect(classifyCause('Lightning')).toBe('natural')
    expect(classifyCause('Natural')).toBe('natural')
  })

  it('treats bare "Human" as human-unspecified (arson vs accident unknown)', () => {
    expect(classifyCause('Human')).toBe('human')
  })

  it('treats undetermined / missing as unknown', () => {
    expect(classifyCause('Under investigation')).toBe('unknown')
    expect(classifyCause('Investigated but Undetermined')).toBe('unknown')
    expect(classifyCause(null)).toBe('unknown')
    expect(classifyCause('')).toBe('unknown')
  })

  it('does not misread "lightning" inside an arson label', () => {
    // Arson is checked first, so an incendiary cause never falls to natural.
    expect(classifyCause('Incendiary (not lightning)')).toBe('arson')
  })
})

describe('causeCategoryLabel / isArson', () => {
  it('labels each category', () => {
    expect(causeCategoryLabel('arson')).toBe('Arson')
    expect(causeCategoryLabel('accidental')).toBe('Accidental')
    expect(causeCategoryLabel('human')).toBe('Human · unspecified')
  })
  it('isArson is a convenience over classifyCause', () => {
    expect(isArson('Arson/Incendiary')).toBe(true)
    expect(isArson('Campfire')).toBe(false)
  })
})

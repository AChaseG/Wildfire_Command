import { describe, it, expect } from 'vitest'
import { severityFromAcres, compareSeverity, sizeClass, SEVERITY_META, SEVERITY_ORDER } from './severity'

describe('severityFromAcres', () => {
  it('maps acreage to bands at the boundaries', () => {
    expect(severityFromAcres(0)).toBe('low')
    expect(severityFromAcres(999)).toBe('low')
    expect(severityFromAcres(1_000)).toBe('moderate')
    expect(severityFromAcres(9_999)).toBe('moderate')
    expect(severityFromAcres(10_000)).toBe('high')
    expect(severityFromAcres(49_999)).toBe('high')
    expect(severityFromAcres(50_000)).toBe('extreme')
  })
})

describe('sizeClass (NWCG A–G)', () => {
  it('maps acreage to the official size classes at boundaries', () => {
    expect(sizeClass(0.25)).toBe('A')
    expect(sizeClass(0.26)).toBe('B')
    expect(sizeClass(9.99)).toBe('B')
    expect(sizeClass(10)).toBe('C')
    expect(sizeClass(99)).toBe('C')
    expect(sizeClass(100)).toBe('D')
    expect(sizeClass(299)).toBe('D')
    expect(sizeClass(300)).toBe('E')
    expect(sizeClass(999)).toBe('E')
    expect(sizeClass(1_000)).toBe('F')
    expect(sizeClass(4_999)).toBe('F')
    expect(sizeClass(5_000)).toBe('G')
    expect(sizeClass(120_000)).toBe('G')
  })
})

describe('compareSeverity', () => {
  it('orders low below extreme and is reflexive', () => {
    expect(compareSeverity('low', 'extreme')).toBeLessThan(0)
    expect(compareSeverity('extreme', 'low')).toBeGreaterThan(0)
    expect(compareSeverity('high', 'high')).toBe(0)
  })

  it('ranks the full order strictly ascending', () => {
    for (let i = 1; i < SEVERITY_ORDER.length; i++) {
      expect(compareSeverity(SEVERITY_ORDER[i - 1]!, SEVERITY_ORDER[i]!)).toBeLessThan(0)
    }
  })

  it('has metadata for every level', () => {
    for (const level of SEVERITY_ORDER) {
      expect(SEVERITY_META[level]).toBeDefined()
    }
  })
})

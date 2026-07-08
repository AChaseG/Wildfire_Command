import { describe, it, expect } from 'vitest'
import { severityFromAcres as connectorSeverity } from '../normalize'
import { severityFromAcres as domainSeverity } from '../../../../src/domain/severity'

// The Deno connector re-declares severityFromAcres (it can't import the browser
// domain at deploy time). This guards against the two copies drifting apart.
describe('connector / domain severity parity', () => {
  it('agree across the acreage range', () => {
    for (const acres of [0, 500, 999, 1000, 5000, 9999, 10000, 30000, 49999, 50000, 120000]) {
      expect(connectorSeverity(acres)).toBe(domainSeverity(acres))
    }
  })
})

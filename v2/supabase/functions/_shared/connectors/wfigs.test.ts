import { describe, it, expect } from 'vitest'
import { parseWfigs, type WfigsFeature } from './wfigs'

const now = new Date('2026-07-08T00:00:00Z')
const feat = (attributes: Record<string, unknown>, geometry?: { x: number; y: number }): WfigsFeature => ({
  attributes,
  geometry,
})

const rows = parseWfigs(
  [
    feat(
      {
        IrwinID: 'abc', IncidentName: 'SMITH RIVER',
        FireDiscoveryDateTime: Date.parse('2026-07-01T00:00:00Z'),
        PercentContained: 45, IncidentSize: 12000, POOState: 'US-CA', POOCounty: 'Del Norte', FireCause: 'Lightning',
      },
      { x: -123.5, y: 41.8 },
    ),
    feat(
      {
        IrwinID: 'def', IncidentName: 'BEAR COMPLEX',
        ContainmentDateTime: Date.parse('2026-07-05T00:00:00Z'), PercentContained: 100, IncidentSize: 800,
      },
      { x: -121.2, y: 40.1 },
    ),
    feat(
      {
        IrwinID: 'ghi', IncidentName: 'OLD OUT FIRE',
        FireOutDateTime: Date.parse('2026-06-30T00:00:00Z'), PercentContained: 100, IncidentSize: 60000,
      },
      { x: -120, y: 39 },
    ),
    feat({ IncidentName: 'No Id' }, { x: 1, y: 2 }),
    feat({ IrwinID: 'x', IncidentName: 'No Geometry' }),
  ],
  now,
)

describe('parseWfigs', () => {
  it('drops features missing an id or geometry', () => {
    expect(rows.map((r) => r.external_id)).toEqual(['abc', 'def', 'ghi'])
  })

  it('normalizes an active incident', () => {
    const r = rows[0]!
    expect(r.name).toBe('Smith River Fire')
    expect(r.severity).toBe('high')
    expect(r.status).toBe('active')
    expect(r.containment_pct).toBe(45)
    expect(r.acres).toBe(12000)
    expect(r.location_description).toBe('Del Norte County, CA')
    expect(r.cause).toBe('Lightning')
    expect(r.ended_at).toBeNull()
    expect(r.source).toBe('NIFC WFIGS')
    expect(r.updated_at).toBe(now.toISOString()) // no ModifiedOnDateTime_dt → falls back to now
  })

  it('uses the IRWIN ModifiedOnDateTime_dt as updated_at when present', () => {
    const modified = Date.parse('2026-07-06T09:30:00Z')
    const [r] = parseWfigs(
      [feat({ IrwinID: 'm', IncidentName: 'MODIFIED', ModifiedOnDateTime_dt: modified }, { x: -120, y: 39 })],
      now,
    )
    expect(r!.updated_at).toBe('2026-07-06T09:30:00.000Z')
  })

  it('keeps a name that already reads as a complex without doubling "Fire"', () => {
    expect(rows[1]!.name).toBe('Bear Complex Fire')
    expect(rows[1]!.name).not.toMatch(/Fire Fire/)
  })

  it('marks a containment-dated / 100% fire contained with no end time', () => {
    expect(rows[1]!.status).toBe('contained')
    expect(rows[1]!.severity).toBe('low')
    expect(rows[1]!.ended_at).toBeNull()
  })

  it('marks a fire with an out date as out and records the end', () => {
    const r = rows[2]!
    expect(r.status).toBe('out')
    expect(r.severity).toBe('extreme')
    expect(r.ended_at).toBe(new Date(Date.parse('2026-06-30T00:00:00Z')).toISOString())
  })
})

import { describe, it, expect } from 'vitest'
import { resolveFireStatus } from './status'
import type { FireStatus } from './fire'

type F = { containmentPct: number; endedAt: string | null; status: FireStatus }
const fire = (o: Partial<F>): F => ({ containmentPct: 0, endedAt: null, status: 'active', ...o })
const upd = (title: string, body = '') => ({ title, body })

describe('resolveFireStatus', () => {
  it('keeps a fire active without evidence', () => {
    expect(resolveFireStatus(fire({ containmentPct: 50 }))).toBeNull()
    expect(resolveFireStatus(fire({}))).toBeNull()
  })

  it('ignores false-positive wording', () => {
    expect(
      resolveFireStatus(fire({ containmentPct: 20 }), [upd('Spread', 'a burned out area remains, crews spread out')]),
    ).toBeNull()
    expect(
      resolveFireStatus(fire({ containmentPct: 30 }), [upd('Grew', 'the fire raged out of control overnight')]),
    ).toBeNull()
    expect(resolveFireStatus(fire({ containmentPct: 90 }), [upd('Containment increased to 90%')])).toBeNull()
  })

  it('resolves full containment from the structured percentage', () => {
    expect(resolveFireStatus(fire({ containmentPct: 100 }))?.status).toBe('contained')
  })

  it('resolves full containment from either word order in the narrative', () => {
    expect(resolveFireStatus(fire({}), [upd('Update', 'the fire is now fully contained')])?.status).toBe('contained')
    expect(resolveFireStatus(fire({}), [upd('Containment increased to 100%')])?.status).toBe('contained')
  })

  it('treats a recorded end date as out, at highest priority', () => {
    const r = resolveFireStatus(fire({ containmentPct: 100, endedAt: '2026-07-01T00:00:00Z' }))
    expect(r?.status).toBe('out')
    expect(r?.endedAt).toBe('2026-07-01T00:00:00Z')
  })

  it('lets "out" wording win over containment and stamps an end time', () => {
    const now = new Date('2026-07-08T00:00:00Z')
    const r = resolveFireStatus(fire({ containmentPct: 100 }), [upd('Status changed to Out')], now)
    expect(r?.status).toBe('out')
    expect(r?.endedAt).toBe('2026-07-08T00:00:00.000Z')
  })
})

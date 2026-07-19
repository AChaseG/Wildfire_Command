import { describe, it, expect } from 'vitest'
import { firePriority, comparePriority, PRIORITY_ORDER, PRIORITY_META } from './priority'
import type { Fire } from './fire'

const f = (acres: number, containmentPct: number, status: Fire['status'] = 'active'): Pick<Fire, 'acres' | 'containmentPct' | 'status'> =>
  ({ acres, containmentPct, status })

describe('firePriority', () => {
  it('is critical when large and poorly contained', () => {
    expect(firePriority(f(20_000, 10))).toBe('critical') // size 3 + cont 3
    expect(firePriority(f(2_000, 0))).toBe('critical') // size 2 + cont 3
  })

  it('drops as containment rises, even at the same size', () => {
    expect(firePriority(f(6_000, 0))).toBe('critical') // 2 + 3
    expect(firePriority(f(6_000, 50))).toBe('high') // 2 + 2
    expect(firePriority(f(6_000, 90))).toBe('moderate') // 2 + 1
    expect(firePriority(f(6_000, 100))).toBe('moderate') // 2 + 0
  })

  it('keeps small fires low unless quite open', () => {
    expect(firePriority(f(50, 100))).toBe('low') // 0 + 0
    expect(firePriority(f(50, 0))).toBe('moderate') // 0 + 3
    expect(firePriority(f(500, 0))).toBe('high') // 1 + 3
  })

  it('treats an out fire as low regardless of size', () => {
    expect(firePriority(f(100_000, 0, 'out'))).toBe('low')
  })
})

describe('comparePriority', () => {
  it('orders the bands strictly ascending', () => {
    for (let i = 1; i < PRIORITY_ORDER.length; i++) {
      expect(comparePriority(PRIORITY_ORDER[i - 1]!, PRIORITY_ORDER[i]!)).toBeLessThan(0)
    }
    expect(PRIORITY_META.critical.rank).toBeGreaterThan(PRIORITY_META.low.rank)
  })
})

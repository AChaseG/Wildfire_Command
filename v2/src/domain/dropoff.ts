// User-configurable "drop-off": hide fires that are still marked active but
// whose record hasn't been updated within a chosen window — i.e. no fresh
// confirmation the fire is still burning. Contained/out fires are already
// resolved, so they're never dropped. `dropOffHours <= 0` disables it.

import type { Fire } from './fire'

type StaleInput = Pick<Fire, 'status' | 'updatedAt'>

export function isStaleActive(fire: StaleInput, dropOffHours: number, now: Date = new Date()): boolean {
  if (dropOffHours <= 0 || fire.status !== 'active') return false
  const updated = Date.parse(fire.updatedAt)
  if (Number.isNaN(updated)) return false // unknown update time → keep it, don't guess
  return now.getTime() - updated > dropOffHours * 3_600_000
}

// The fires still worth showing, with stale active incidents dropped.
export function applyDropOff<T extends StaleInput>(fires: readonly T[], dropOffHours: number, now: Date = new Date()): T[] {
  if (dropOffHours <= 0) return fires.slice()
  return fires.filter((f) => !isStaleActive(f, dropOffHours, now))
}

// Client-side incident history: with no backend to keep a change log, the app
// snapshots each fire's key fields on every fetch and diffs against the last
// snapshot. Observed deltas accumulate (persisted in the browser) into a real
// progression history — containment climbing, size growing, status changing.
// These functions are the pure core; persistence lives in lib/fireHistory.ts.

import type { Fire, FireStatus, FireUpdate, Severity } from './fire'
import { formatArea, type UnitSystem } from './units'

export interface FireSnapshot {
  containmentPct: number
  acres: number
  status: FireStatus
  severity: Severity
  observedAt: string
}

export type ChangeField = 'containment' | 'size' | 'status' | 'severity'

export interface ObservedChange {
  observedAt: string
  field: ChangeField
  from: number | string
  to: number | string
}

// A size change must clear both an absolute and a relative floor, so day-to-day
// acreage jitter on large fires does not spam the feed.
const SIZE_MIN_ABS_ACRES = 10
const SIZE_MIN_REL = 0.05

export function snapshotOf(fire: Fire, observedAt: string): FireSnapshot {
  return {
    containmentPct: fire.containmentPct,
    acres: fire.acres,
    status: fire.status,
    severity: fire.severity,
    observedAt,
  }
}

function sizeChanged(prev: number, next: number): boolean {
  const delta = Math.abs(next - prev)
  return delta >= SIZE_MIN_ABS_ACRES && delta / Math.max(prev, 1) >= SIZE_MIN_REL
}

// Meaningful changes from prev -> next, timestamped at next.observedAt.
export function diffSnapshot(prev: FireSnapshot, next: FireSnapshot): ObservedChange[] {
  const at = next.observedAt
  const changes: ObservedChange[] = []
  if (next.containmentPct !== prev.containmentPct) {
    changes.push({ observedAt: at, field: 'containment', from: prev.containmentPct, to: next.containmentPct })
  }
  if (sizeChanged(prev.acres, next.acres)) {
    changes.push({ observedAt: at, field: 'size', from: prev.acres, to: next.acres })
  }
  if (next.status !== prev.status) {
    changes.push({ observedAt: at, field: 'status', from: prev.status, to: next.status })
  }
  if (next.severity !== prev.severity) {
    changes.push({ observedAt: at, field: 'severity', from: prev.severity, to: next.severity })
  }
  return changes
}

// Whether prev should be replaced as the diff baseline (i.e. anything changed).
export function snapshotDiffers(prev: FireSnapshot, next: FireSnapshot): boolean {
  return diffSnapshot(prev, next).length > 0
}

const KIND: Record<ChangeField, FireUpdate['kind']> = {
  containment: 'containment',
  size: 'general',
  status: 'general',
  severity: 'general',
}

// Render an observed change as a feed item, formatting size in the active units.
export function changeToUpdate(change: ObservedChange, fireId: string, units: UnitSystem): FireUpdate {
  let title = ''
  switch (change.field) {
    case 'containment': {
      const dir = Number(change.to) >= Number(change.from) ? 'increased' : 'decreased'
      title = `Containment ${dir} to ${change.to}%`
      break
    }
    case 'size': {
      const dir = Number(change.to) >= Number(change.from) ? 'Grew' : 'Reduced'
      title = `${dir} to ${formatArea(Number(change.to), units)}`
      break
    }
    case 'status':
      title = `Status changed to ${change.to}`
      break
    case 'severity':
      title = `Severity changed to ${change.to}`
      break
  }
  return {
    id: `${fireId}:obs:${change.observedAt}:${change.field}`,
    fireId,
    postedAt: change.observedAt,
    kind: KIND[change.field],
    title,
    body: '',
  }
}

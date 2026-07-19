// Fire "priority" — the dimension the map colors by. Unlike NWCG Size Class
// (official, size only), this is the app's own transparent heuristic combining
// how big a fire is with how contained it is: a large, barely-contained fire
// ranks above an equally large but mostly-contained one. It is NOT an official
// scale; the authoritative size number (Size Class A–G) is shown alongside.

import type { Fire } from './fire'

export type Priority = 'low' | 'moderate' | 'high' | 'critical'

export const PRIORITY_ORDER: readonly Priority[] = ['low', 'moderate', 'high', 'critical']

export interface PriorityMeta { label: string; color: string; rank: number }

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  low: { label: 'Low', color: '#3fb950', rank: 0 },
  moderate: { label: 'Moderate', color: '#f0a020', rank: 1 },
  high: { label: 'High', color: '#f85149', rank: 2 },
  critical: { label: 'Critical', color: '#a01a1a', rank: 3 },
}

// Size contribution (0–3), by acres.
function sizeScore(acres: number): number {
  if (acres < 100) return 0
  if (acres < 1_000) return 1
  if (acres < 10_000) return 2
  return 3
}

// Containment contribution (0–3): more open line → higher.
function containmentScore(pct: number): number {
  const p = Math.max(0, Math.min(100, pct))
  if (p >= 100) return 0
  if (p >= 75) return 1
  if (p >= 40) return 2
  return 3
}

// Combined 0–6 score → four bands. An out fire is never a priority.
export function firePriority(fire: Pick<Fire, 'acres' | 'containmentPct' | 'status'>): Priority {
  if (fire.status === 'out') return 'low'
  const score = sizeScore(fire.acres) + containmentScore(fire.containmentPct)
  if (score >= 5) return 'critical'
  if (score >= 4) return 'high'
  if (score >= 2) return 'moderate'
  return 'low'
}

export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_META[a].rank - PRIORITY_META[b].rank
}

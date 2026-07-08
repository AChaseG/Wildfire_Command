import type { Fire, FireStatus, FireUpdate } from './fire'

// Strong phrases only — never match a bare "out" ("burned out", "out of
// control", "spread out" would all be false positives).
const OUT_RE = /\b(?:declared out|fire\s+is\s+out|is\s+now\s+out|status\s+changed\s+to\s+out)\b/i
// Full containment worded either way: "100% contained" or "containment … 100%".
// The percentage must sit next to containment wording (bounded gap) so plain
// acreage like "100 acres" never matches.
const CONTAINED_RE =
  /\bfully\s+contained\b|\b100\s*(?:%|percent)\s*contain|\bcontain(?:ment|ed)?\b[^.\n]{0,40}?\b100\s*(?:%|percent)/i

export interface StatusResolution {
  status: Extract<FireStatus, 'contained' | 'out'>
  // Timestamp to record as the end when transitioning to "out" and none was set;
  // null when the fire stays open (contained but still burning).
  endedAt: string | null
  reason: string
}

type FireInput = Pick<Fire, 'containmentPct' | 'endedAt' | 'status'>
type UpdateInput = Pick<FireUpdate, 'title' | 'body'>

// Decides, from the data an incident already carries, whether it should still be
// "active". Structured fields first, then the narrative of recent updates (for
// sources that only report progress as text). Returns the non-active status it
// should take, or null when the evidence does not show it contained or out.
export function resolveFireStatus(
  fire: FireInput,
  updates: readonly UpdateInput[] = [],
  now: Date = new Date(),
): StatusResolution | null {
  if (fire.endedAt) {
    return { status: 'out', endedAt: fire.endedAt, reason: 'end date recorded' }
  }

  const text = updates.map((u) => `${u.title ?? ''} ${u.body ?? ''}`).join(' \n ')

  if (OUT_RE.test(text)) {
    return { status: 'out', endedAt: now.toISOString(), reason: 'an update reports the fire is out' }
  }

  if (Number.isFinite(fire.containmentPct) && fire.containmentPct >= 100) {
    return { status: 'contained', endedAt: null, reason: 'containment reached 100%' }
  }

  if (CONTAINED_RE.test(text)) {
    return { status: 'contained', endedAt: null, reason: 'an update reports full containment' }
  }

  return null
}

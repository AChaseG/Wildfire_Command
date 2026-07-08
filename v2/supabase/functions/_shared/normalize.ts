import type { FireStatus, Severity } from './connectors/types.ts'

export type Attrs = Record<string, unknown>

export function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// First non-empty value among the candidate keys.
export function pick(attr: Attrs, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = attr[k]
    if (v != null && v !== '') return v
  }
  return null
}

export function titleCaseName(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// Mirrors src/domain/severity.ts severityFromAcres; a vitest parity test asserts
// the two stay in agreement so this Deno-side copy can't silently drift.
export function severityFromAcres(acres: number): Severity {
  if (acres >= 50_000) return 'extreme'
  if (acres >= 10_000) return 'high'
  if (acres >= 1_000) return 'moderate'
  return 'low'
}

// Derives status from the WFIGS date/percent fields: an out/control date means
// the incident is over; a containment date or 100% means contained.
export function statusFromWfigs(attr: Attrs, containment: number): FireStatus {
  if (pick(attr, ['FireOutDateTime', 'ControlDateTime'])) return 'out'
  if (pick(attr, ['ContainmentDateTime']) || containment >= 100) return 'contained'
  return 'active'
}

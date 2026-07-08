import type { Severity } from './fire'

export const SEVERITY_ORDER: readonly Severity[] = ['low', 'moderate', 'high', 'extreme']

export interface SeverityMeta {
  label: string
  color: string
  rank: number
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  low: { label: 'Low', color: '#3fb950', rank: 0 },
  moderate: { label: 'Moderate', color: '#f0a020', rank: 1 },
  high: { label: 'High', color: '#f85149', rank: 2 },
  extreme: { label: 'Extreme', color: '#a01a1a', rank: 3 },
}

// Acreage bands, matching the mapping the WFIGS ingester applies so severity is
// consistent no matter which connector produced the incident.
export function severityFromAcres(acres: number): Severity {
  if (acres >= 50_000) return 'extreme'
  if (acres >= 10_000) return 'high'
  if (acres >= 1_000) return 'moderate'
  return 'low'
}

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_META[a].rank - SEVERITY_META[b].rank
}

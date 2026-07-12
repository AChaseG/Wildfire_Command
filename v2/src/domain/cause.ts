// Classify an incident's cause so human-caused fires can be told apart —
// specifically arson (NWCG "Incendiary") from accidental human causes (debris
// burning, equipment, campfire, smoking, powerline, railroad, fireworks, …).
// Derived purely from the WFIGS cause text (FireCauseSpecific/General), so it
// works in every data mode with no schema change.

export type CauseCategory = 'natural' | 'arson' | 'accidental' | 'human' | 'unknown'

// Specific human causes that are accidental/unintentional (NWCG specific-cause
// vocabulary, plus common legacy spellings).
const ACCIDENTAL = /debris|open burning|burning|equipment|vehicle|machine|smoking|campfire|recreation|ceremony|railroad|railway|firework|children|minor|powerline|power line|power generation|transmission|electrical|utility|escaped|explosive|firearm/

export function classifyCause(cause: string | null | undefined): CauseCategory {
  const c = (cause ?? '').toLowerCase().trim()
  if (!c) return 'unknown'
  // Arson first: it's the distinction we most care about and is unambiguous.
  if (/arson|incendiary/.test(c)) return 'arson'
  if (/lightning|natural/.test(c)) return 'natural'
  if (/undetermined|under investigation|investigated|unknown/.test(c)) return 'unknown'
  if (ACCIDENTAL.test(c)) return 'accidental'
  // Known to be human but no specific agent given (e.g. just "Human").
  if (/human|person/.test(c)) return 'human'
  return 'unknown'
}

const LABELS: Record<CauseCategory, string> = {
  natural: 'Natural',
  arson: 'Arson',
  accidental: 'Accidental',
  human: 'Human · unspecified',
  unknown: 'Undetermined',
}

export function causeCategoryLabel(category: CauseCategory): string {
  return LABELS[category]
}

// Whether a fire's cause was deliberately set (arson). Convenience for filters.
export function isArson(cause: string | null | undefined): boolean {
  return classifyCause(cause) === 'arson'
}

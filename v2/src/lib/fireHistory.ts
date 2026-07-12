// Browser-persisted incident history. On every fetch we snapshot each fire and
// diff against what we last saw; the observed deltas are appended to a per-fire
// log in localStorage. No backend — the history is whatever this browser has
// witnessed while the app was open, and it accrues over time.

import {
  diffSnapshot,
  snapshotOf,
  snapshotDiffers,
  type Fire,
  type FireSnapshot,
  type ObservedChange,
} from '../domain'

const SNAP_KEY = 'wc-fire-snap'
const HIST_KEY = 'wc-fire-hist'
const MAX_EVENTS_PER_FIRE = 100
const MAX_FIRES = 1000

type SnapMap = Record<string, FireSnapshot>
type HistMap = Record<string, ObservedChange[]>

function read<T>(key: string): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as T
  } catch {
    return {} as T
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable — history is best-effort, so ignore.
  }
}

// Keep the maps from growing without bound: retain the most recently observed
// fires (they carry the freshest snapshots).
function prune(snap: SnapMap, hist: HistMap): void {
  const ids = Object.keys(snap)
  if (ids.length <= MAX_FIRES) return
  const keep = new Set(
    ids
      .sort((a, b) => Date.parse(snap[b].observedAt) - Date.parse(snap[a].observedAt))
      .slice(0, MAX_FIRES),
  )
  for (const id of ids) {
    if (!keep.has(id)) {
      delete snap[id]
      delete hist[id]
    }
  }
}

// Diff the current fires against stored snapshots, appending any changes.
// Returns the number of new change events recorded (0 if nothing changed).
export function recordObservations(fires: readonly Fire[], now: Date = new Date()): number {
  if (typeof localStorage === 'undefined' || fires.length === 0) return 0
  const at = now.toISOString()
  const snap = read<SnapMap>(SNAP_KEY)
  const hist = read<HistMap>(HIST_KEY)
  let recorded = 0

  for (const fire of fires) {
    const next = snapshotOf(fire, at)
    const prev = snap[fire.id]
    if (!prev) {
      // First sighting: seed the baseline; we can't invent prior history.
      snap[fire.id] = next
      continue
    }
    if (!snapshotDiffers(prev, next)) continue
    const changes = diffSnapshot(prev, next)
    const log = (hist[fire.id] ?? []).concat(changes)
    hist[fire.id] = log.slice(-MAX_EVENTS_PER_FIRE)
    snap[fire.id] = next
    recorded += changes.length
  }

  if (recorded > 0) {
    prune(snap, hist)
    write(SNAP_KEY, snap)
    write(HIST_KEY, hist)
  } else {
    // Persist any newly seeded baselines without rewriting the (unchanged) log.
    write(SNAP_KEY, snap)
  }
  return recorded
}

// The recorded change log for one fire, oldest first.
export function getFireHistory(fireId: string): ObservedChange[] {
  if (typeof localStorage === 'undefined') return []
  return read<HistMap>(HIST_KEY)[fireId] ?? []
}

import { useMemo, useState } from 'react'
import { formatArea, type Fire } from '../domain'
import { useUnits } from '../lib/units'
import { SeverityDot } from './badges'

type StatusFilter = 'all' | 'active' | 'contained' | 'out'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'contained', label: 'Contained' },
  { value: 'out', label: 'Out' },
]

function matchesFilter(fire: Fire, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'contained') return fire.status === 'contained' || fire.status === 'controlled'
  return fire.status === filter
}

interface Props {
  fires: Fire[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  // Total loaded incidents (fires is already limited to the map viewport), used
  // to show how many are off-screen.
  total?: number
  // When set, the list is filtered to a saved place's alert radius (not the
  // viewport); shows a clearable chip instead of the viewport note.
  focus?: { label: string; onClear: () => void }
}

export function IncidentList({ fires, selectedId, onSelect, loading, total, focus }: Props) {
  const { units } = useUnits()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return fires
      .filter((f) => matchesFilter(f, filter))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.location.description ?? '').toLowerCase().includes(q))
  }, [fires, filter, query])

  return (
    <div className="list-inner">
      <div className="list-head">
        <input
          className="search"
          placeholder="Search incidents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search incidents"
        />
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`chip ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="list-scroll">
        {loading && <p className="list-empty">Loading incidents…</p>}
        {!loading && focus && (
          <div className="list-note focus-note">
            <span>{focus.label}</span>
            <button className="focus-clear" onClick={focus.onClear} type="button" aria-label="Clear place filter">✕</button>
          </div>
        )}
        {!loading && !focus && typeof total === 'number' && total > fires.length && (
          <p className="list-note">Showing {visible.length} in the current map view · {total} total. Zoom out to see more.</p>
        )}
        {!loading && visible.length === 0 && focus && (
          <p className="list-empty">No fires within this range.</p>
        )}
        {!loading && visible.length === 0 && !focus && fires.length === 0 && typeof total === 'number' && total > 0 && (
          <p className="list-empty">No incidents in the current map view. Zoom out or pan the map.</p>
        )}
        {!loading && visible.length === 0 && !focus && !(fires.length === 0 && typeof total === 'number' && total > 0) && (
          <p className="list-empty">No incidents match.</p>
        )}
        {visible.map((fire) => (
          <button
            key={fire.id}
            className={`row ${selectedId === fire.id ? 'selected' : ''}`}
            onClick={() => onSelect(fire.id)}
            type="button"
          >
            <SeverityDot severity={fire.severity} />
            <span className="row-main">
              <span className="row-name">{fire.name}</span>
              <span className="row-sub">{fire.location.description ?? '—'}</span>
            </span>
            <span className="row-meta">
              <span className="row-acres">{formatArea(fire.acres, units)}</span>
              <span className="row-cont">{fire.containmentPct}%</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

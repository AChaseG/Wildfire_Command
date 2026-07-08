import { useMemo, useState } from 'react'
import { formatArea, type Fire } from '../domain'
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
}

export function IncidentList({ fires, selectedId, onSelect, loading }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return fires
      .filter((f) => matchesFilter(f, filter))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.location.description ?? '').toLowerCase().includes(q))
  }, [fires, filter, query])

  return (
    <aside className="list">
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
        {!loading && visible.length === 0 && <p className="list-empty">No incidents match.</p>}
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
              <span className="row-acres">{formatArea(fire.acres, 'imperial')}</span>
              <span className="row-cont">{fire.containmentPct}%</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

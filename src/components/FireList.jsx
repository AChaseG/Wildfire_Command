import { useState, useMemo } from 'react'
import { SEVERITY_META, STATUS_META, aqiCategory, formatRelative } from '../lib/fireUtils'
import { acresLabel } from '../lib/units'
import { useUnits } from '../context/UnitsContext'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'contained', label: 'Contained' },
  { key: 'extreme', label: 'Extreme' },
]

export default function FireList({
  fires,
  totalCount,
  selectedId,
  onSelect,
  filter,
  onFilter,
}) {
  const { units } = useUnits()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visibleFires = useMemo(() => {
    if (!q) return fires
    return fires.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.location_description?.toLowerCase().includes(q),
    )
  }, [fires, q])

  return (
    <div className="fire-list">
      <div className="list-header">
        <h3>Active Incidents</h3>
        <span className="list-count">{visibleFires.length} of {totalCount}</span>
      </div>

      <div className="list-search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          className="list-search-input"
          placeholder="Search fires by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search incidents by name"
        />
        {query && (
          <button
            className="list-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="list-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => onFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="list-items">
        {visibleFires.map((fire) => {
          const sev = SEVERITY_META[fire.severity] || SEVERITY_META.moderate
          const status = STATUS_META[fire.status] || STATUS_META.active
          const aqi = aqiCategory(fire.air_quality)
          const isSelected = fire.id === selectedId
          return (
            <li
              key={fire.id}
              className={`fire-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(fire.id)}
            >
              <div className="fire-card-top">
                <span className="severity-dot" style={{ background: sev.color }} />
                <div className="fire-card-name">{fire.name}</div>
                <span className="fire-card-status" style={{ color: status.color }}>
                  {status.label}
                </span>
              </div>
              <div className="fire-card-meta">
                <span>{fire.location_description}</span>
                <span>· {acresLabel(fire.acreage_burned, units)}</span>
              </div>
              <div className="fire-card-stats">
                <span className="chip" style={{ color: sev.color, borderColor: sev.color }}>
                  {sev.label}
                </span>
                <span className="chip" style={{ color: aqi.color, borderColor: aqi.color }}>
                  AQI {fire.air_quality ?? '—'}
                </span>
                <span className="chip muted">Containment {fire.containment_pct}%</span>
              </div>
              <div className="fire-card-time">Started {formatRelative(fire.started_at)}</div>
            </li>
          )
        })}
        {visibleFires.length === 0 && (
          <li className="list-empty">
            {q
              ? `No incidents match “${query.trim()}”.`
              : totalCount > 0
                ? 'No incidents in the current map view. Zoom out or pan to see more.'
                : 'No fires match this filter.'}
          </li>
        )}
      </ul>
    </div>
  )
}

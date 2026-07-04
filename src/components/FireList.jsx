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

  return (
    <div className="fire-list">
      <div className="list-header">
        <h3>Active Incidents</h3>
        <span className="list-count">{fires.length} of {totalCount}</span>
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
        {fires.map((fire) => {
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
        {fires.length === 0 && (
          <li className="list-empty">
            {totalCount > 0
              ? 'No incidents in the current map view. Zoom out or pan to see more.'
              : 'No fires match this filter.'}
          </li>
        )}
      </ul>
    </div>
  )
}

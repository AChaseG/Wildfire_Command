import { ALERT_SEVERITY, ALERT_CATEGORY, formatAlertStamp } from '../lib/alertUtils'
import { SEVERITY_META, aqiCategory, formatDateTime } from '../lib/fireUtils'
import { acresLabel } from '../lib/units'
import { useUnits } from '../context/UnitsContext'
import { useDrag } from '../hooks/useDrag'

function CategoryIcon({ name }) {
  const common = {
    width: 13, height: 13, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  }
  switch (name) {
    case 'fire': return <svg {...common}><path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" /></svg>
    case 'cloud': return <svg {...common}><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 6 19z" /></svg>
    case 'shield': return <svg {...common}><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" /></svg>
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
  }
}

export default function AlertDetailFloat({ alert: a, fire, onClose, onSelectFire }) {
  const { units } = useUnits()
  const { pos, handleMouseDown } = useDrag({ x: window.innerWidth / 2 - 300, y: 80 })

  if (!a) return null

  const sev = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.low
  const cat = ALERT_CATEGORY[a.category] || ALERT_CATEGORY.general

  return (
    <div
      className="alert-float"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="alert-float-header" onMouseDown={handleMouseDown}>
        <div className="alert-float-drag-hint">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 9h14M5 15h14" />
          </svg>
        </div>
        <div className="alert-float-title">
          <span className="alert-sev-tag" style={{ color: sev.color, borderColor: sev.color }}>
            {sev.label}
          </span>
          <span className="alert-cat" style={{ color: sev.color }}>
            <CategoryIcon name={cat.icon} />
            {cat.label}
          </span>
          <span className="alert-float-time">{formatAlertStamp(a.generated_at)}</span>
        </div>
        <button className="alert-float-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="alert-float-body">
        {/* Alert column */}
        <div className="alert-float-col">
          <div className="alert-float-col-label">Alert</div>
          {a.source_type === 'social' && (
            <div className="social-warning-bar" style={{ marginBottom: 6 }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2 1 21h22z" /><path d="M12 9v5M12 18v.5" />
              </svg>
              SOCIAL MEDIA — UNVERIFIED
            </div>
          )}
          <div className="alert-float-headline">{a.headline}</div>
          <div className="alert-float-summary">{a.summary}</div>
          <div className="alert-float-meta">
            <span>{a.source}</span>
            {a.rule_name && (
              <span className="rule-badge">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
                </svg>
                {a.rule_name}
              </span>
            )}
            {a.content_url && (
              <a href={a.content_url} target="_blank" rel="noreferrer" className="alert-link">
                Source
              </a>
            )}
          </div>
        </div>

        {/* Incident column */}
        <div className="alert-float-col">
          <div className="alert-float-col-label">Connected Incident</div>
          {fire ? (
            <>
              <div className="alert-float-fire-name">{fire.name}</div>
              <div className="alert-float-fire-loc">{fire.location_description}</div>
              <div className="alert-float-fire-stats">
                <div className="affs">
                  <span className="affs-label">Area</span>
                  <span>{acresLabel(fire.acreage_burned, units)}</span>
                </div>
                <div className="affs">
                  <span className="affs-label">Containment</span>
                  <span>{fire.containment_pct}%</span>
                </div>
                <div className="affs">
                  <span className="affs-label">Status</span>
                  <span style={{ textTransform: 'capitalize' }}>{fire.status}</span>
                </div>
                <div className="affs">
                  <span className="affs-label">AQI</span>
                  <span style={{ color: aqiCategory(fire.air_quality).color }}>
                    {fire.air_quality ?? '—'}
                  </span>
                </div>
                <div className="affs">
                  <span className="affs-label">Started</span>
                  <span>{formatDateTime(fire.started_at)}</span>
                </div>
                <div className="affs">
                  <span className="affs-label">Severity</span>
                  <span style={{ color: (SEVERITY_META[fire.severity] || SEVERITY_META.moderate).color }}>
                    {fire.severity}
                  </span>
                </div>
              </div>
              <button
                className="alert-float-view-btn"
                onClick={() => { onSelectFire(fire.id); onClose() }}
              >
                View full incident
              </button>
            </>
          ) : (
            <div className="alert-float-no-fire">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
              </svg>
              No connected fire incident
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

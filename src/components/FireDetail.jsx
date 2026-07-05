import {
  SEVERITY_META,
  STATUS_META,
  aqiCategory,
  formatDateTime,
  fireDuration,
} from '../lib/fireUtils'
import { acresLabel, windSpeedLabel } from '../lib/units'
import { useUnits } from '../context/UnitsContext'
import { ALERT_SEVERITY } from '../lib/alertUtils'
import { RuleBadge } from './AlertCard'
import { haversine } from '../lib/geoUtils'

function Stat({ label, value, accent }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  )
}

function RelatedAlertRow({ alert: a, onSelect }) {
  const sev = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.low
  const isSocial = a.source_type === 'social'
  return (
    <div
      className={`related-alert-row ${isSocial ? 'social' : ''}`}
      onClick={() => onSelect && onSelect(a)}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <span className="related-alert-rail" style={{ background: sev.color }} />
      <div className="related-alert-content">
        <div className="related-alert-top">
          <span className="related-sev" style={{ color: sev.color }}>
            {sev.pulse && <span className="pulse-dot" style={{ background: sev.color }} />}
            {sev.label}
          </span>
          {isSocial && <span className="related-social-tag">SOCIAL MEDIA</span>}
          <RuleBadge ruleName={a.rule_name} />
        </div>
        <div className="related-alert-headline">{a.headline}</div>
        <div className="related-alert-meta">
          {a.source} · {new Date(a.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

function formatDist(meters, units) {
  if (units === 'metric') {
    const km = meters / 1000
    return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`
  }
  const miles = meters / 1609.344
  return miles < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${miles.toFixed(1)} mi`
}

const EVAC_LEVELS = {
  flash: { label: 'Mandatory Evacuation Order', color: '#ff2e2e', note: 'Leave the area immediately.' },
  urgent: { label: 'Mandatory Evacuation Order', color: '#f85149', note: 'Leave the area immediately.' },
  high: { label: 'Evacuation Warning', color: '#f0a020', note: 'Be ready to leave at a moment’s notice.' },
  medium: { label: 'Evacuation Advisory', color: '#58a6ff', note: 'Stay alert and prepared to leave.' },
  low: { label: 'Evacuation Advisory', color: '#58a6ff', note: 'Stay alert and prepared to leave.' },
}

// Derived only from real evacuation-category alerts linked to this incident —
// shown when applicable, using the highest-severity linked evacuation alert.
function evacuationFromAlerts(alerts) {
  const evac = alerts.filter((a) => a.category === 'evacuation')
  if (evac.length === 0) return null
  const top = evac.reduce((best, a) =>
    (ALERT_SEVERITY[a.severity]?.rank ?? 0) > (ALERT_SEVERITY[best.severity]?.rank ?? 0) ? a : best,
  )
  return { ...(EVAC_LEVELS[top.severity] || EVAC_LEVELS.medium), count: evac.length }
}

export default function FireDetail({ fire, onClose, relatedAlerts = [], keyLocations = [], onSelectAlert, onToggleMonitor }) {
  const { units } = useUnits()
  if (!fire) {
    return (
      <div className="fire-detail empty">
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" />
            </svg>
          </div>
          <h3>Select a wildfire</h3>
          <p>Click a fire marker on the map or choose one from the list to view detailed incident information and the live updates feed.</p>
        </div>
      </div>
    )
  }

  const sev = SEVERITY_META[fire.severity] || SEVERITY_META.moderate
  const status = STATUS_META[fire.status] || STATUS_META.active
  const aqi = aqiCategory(fire.air_quality)

  const lat = Number(fire.latitude)
  const lng = Number(fire.longitude)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
  const coordLabel = hasCoords
    ? `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
    : '—'

  const evac = evacuationFromAlerts(relatedAlerts)

  const distancesToLocations = keyLocations.map((loc) => ({
    loc,
    dist: haversine(
      { lat: fire.latitude, lng: fire.longitude },
      { lat: loc.latitude, lng: loc.longitude },
    ),
  })).sort((a, b) => a.dist - b.dist)

  return (
    <div className="fire-detail">
      <div className="detail-header">
        <div className="detail-title-row">
          <div>
            <div className="detail-eyebrow">{fire.location_description}</div>
            <h2>{fire.name}</h2>
          </div>
          <div className="detail-header-actions">
            {onToggleMonitor && (
              <button
                className={`monitor-btn ${fire.monitored ? 'on' : ''}`}
                onClick={() => onToggleMonitor(fire.id, !fire.monitored)}
                title={fire.monitored ? 'Monitoring — updates are sent to your external channel' : 'Monitor this incident and relay its updates externally'}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill={fire.monitored ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {fire.monitored ? 'Monitoring' : 'Monitor'}
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close details">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="detail-badges">
          <span className="badge" style={{ background: sev.color }}>
            {sev.label} severity
          </span>
          <span className="badge outline" style={{ color: status.color, borderColor: status.color }}>
            {status.label}
          </span>
          <span className="badge outline" style={{ color: aqi.color, borderColor: aqi.color }}>
            AQI {fire.air_quality ?? '—'} · {aqi.label}
          </span>
        </div>
        {fire.summary && <p className="detail-summary">{fire.summary}</p>}
      </div>

      {evac ? (
        <div className="evac-banner" style={{ borderColor: evac.color, background: `${evac.color}1a` }}>
          <span className="evac-icon" style={{ color: evac.color }} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 1 21h22L12 2z" />
              <path d="M12 9v5M12 17h.01" />
            </svg>
          </span>
          <div className="evac-text">
            <div className="evac-level" style={{ color: evac.color }}>{evac.label}</div>
            <div className="evac-note">
              {evac.note} · {evac.count} evacuation alert{evac.count === 1 ? '' : 's'} linked
            </div>
          </div>
        </div>
      ) : (
        <div className="evac-banner unknown">
          <span className="evac-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3M12 17h.01" />
            </svg>
          </span>
          <div className="evac-text">
            <div className="evac-level">Evacuation status unconfirmed</div>
            <div className="evac-note">
              No evacuation orders have been ingested for this incident. This does not mean the
              area is clear — verify current orders with official sources.
            </div>
            <a
              className="evac-source-link"
              href={`https://www.bing.com/search?q=${encodeURIComponent(`${fire.name} evacuation order`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Check official evacuation orders
            </a>
          </div>
        </div>
      )}

      <div className="containment-bar-wrap">
        <div className="containment-bar-label">
          <span>Containment</span>
          <span className="containment-pct">{fire.containment_pct}%</span>
        </div>
        <div className="containment-bar">
          <div
            className="containment-fill"
            style={{
              width: `${fire.containment_pct}%`,
              background:
                fire.containment_pct >= 75
                  ? 'linear-gradient(90deg, #3fb950, #56d364)'
                  : fire.containment_pct >= 25
                    ? 'linear-gradient(90deg, #f0a020, #f97316)'
                    : 'linear-gradient(90deg, #f85149, #a01a1a)',
            }}
          />
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Area Burned" value={acresLabel(fire.acreage_burned, units)} />
        <Stat label="Wind" value={`${windSpeedLabel(fire.wind_speed, units)} ${fire.wind_direction ?? ''}`} />
        <Stat label="Started" value={formatDateTime(fire.started_at)} />
        <Stat label="Ended" value={formatDateTime(fire.ended_at)} />
        <Stat label="Duration" value={fireDuration(fire.started_at, fire.ended_at)} />
        <Stat label="Air Quality (AQI)" value={fire.air_quality ?? '—'} accent={aqi.color} />
        <Stat label="Coordinates" value={coordLabel} />
      </div>

      <div className="cause-row">
        <span className="cause-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" />
          </svg>
        </span>
        <span className="cause-label">Cause of ignition</span>
        <span className="cause-value">{fire.cause || 'Under investigation'}</span>
      </div>

      <div className="detail-coords">
        <span>{coordLabel}</span>
      </div>

      {fire.source && (
        <div className="detail-source">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="12" rx="10" ry="4" />
            <path d="M2 12c0 5.5 4.5 10 10 10s10-4.5 10-10" />
            <path d="M12 2v20" />
          </svg>
          <span className="detail-source-label">Data source</span>
          {fire.source_url ? (
            <a
              className="detail-source-value"
              href={fire.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fire.source}
            </a>
          ) : (
            <span className="detail-source-value">{fire.source}</span>
          )}
        </div>
      )}

      {distancesToLocations.length > 0 && (
        <div className="key-dist-section">
          <div className="key-dist-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Distance to key locations
          </div>
          <div className="key-dist-list">
            {distancesToLocations.map(({ loc, dist }) => (
              <div key={loc.id} className="key-dist-row">
                <span className="key-dist-dot" style={{ background: loc.color }} />
                <span className="key-dist-name">{loc.name}</span>
                <span className="key-dist-val">{formatDist(dist, units)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedAlerts.length > 0 && (
        <div className="related-alerts-section">
          <div className="related-alerts-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Triggered alerts ({relatedAlerts.length})
          </div>
          <div className="related-alerts-list">
            {relatedAlerts.slice(0, 8).map((a) => (
              <RelatedAlertRow key={a.id} alert={a} onSelect={onSelectAlert} />
            ))}
            {relatedAlerts.length > 8 && (
              <div className="related-more">+{relatedAlerts.length - 8} more alerts</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

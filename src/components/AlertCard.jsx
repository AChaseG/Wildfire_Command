import { ALERT_SEVERITY, ALERT_CATEGORY, formatAlertTime, formatAlertStamp } from '../lib/alertUtils'
import { PLATFORMS } from './AddSocialAlertModal'

function CategoryIcon({ name }) {
  const common = {
    width: 13, height: 13, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (name) {
    case 'fire': return <svg {...common}><path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" /></svg>
    case 'cloud': return <svg {...common}><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 6 19z" /></svg>
    case 'alert': return <svg {...common}><path d="M12 2 1 21h22z" /><path d="M12 9v5M12 18v.5" /></svg>
    case 'wind': return <svg {...common}><path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h17" /></svg>
    case 'shield': return <svg {...common}><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" /></svg>
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
  }
}

function PlatformIcon({ platform, color }) {
  const common = { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'currentColor', style: { color } }
  switch (platform) {
    case 'facebook': return <svg {...common}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
    case 'twitter': return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
      </svg>
    )
    case 'instagram': return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    )
    case 'youtube': return <svg {...common}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff" /></svg>
    case 'nextdoor': return <svg {...common}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    default: return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
  }
}

function SourceTypeBadge({ sourceType, socialPlatform }) {
  if (sourceType === 'social') {
    const plat = PLATFORMS.find((p) => p.value === socialPlatform) || PLATFORMS[PLATFORMS.length - 1]
    return (
      <span className="source-type-badge social" style={{ borderColor: plat.color, color: plat.color }}>
        <PlatformIcon platform={socialPlatform} color={plat.color} />
        {plat.label}
        <span className="unverified-tag">UNVERIFIED</span>
      </span>
    )
  }
  if (sourceType === 'rss') {
    return (
      <span className="source-type-badge rss">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
          <circle cx="6.18" cy="17.82" r="2.18" />
          <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z" />
        </svg>
        RSS Import
      </span>
    )
  }
  if (sourceType === 'manual') {
    return (
      <span className="source-type-badge manual">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Manual
      </span>
    )
  }
  return null
}

export function RuleBadge({ ruleName }) {
  if (!ruleName) return null
  return (
    <span className="rule-badge">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
      </svg>
      {ruleName}
    </span>
  )
}

export default function AlertCard({ alert: a, onAcknowledge, onDelete, onSelectFire, onViewDetail, compact = false }) {
  const sev = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.low
  const cat = ALERT_CATEGORY[a.category] || ALERT_CATEGORY.general
  const isSocial = a.source_type === 'social'

  return (
    <li className={`alert-card ${a.acknowledged ? 'ack' : ''} severity-${a.severity} ${isSocial ? 'social-alert' : ''}`}>
      <div className="alert-rail" style={{ background: sev.color }} />
      <div className="alert-body">
        <div className="alert-meta">
          <span className="alert-sev-tag" style={{ color: sev.color, borderColor: sev.color }}>
            {sev.pulse && <span className="pulse-dot" style={{ background: sev.color }} />}
            {sev.label}
          </span>
          <span className="alert-cat" style={{ color: sev.color }}>
            <CategoryIcon name={cat.icon} />
            {cat.label}
          </span>
          <span className="alert-time">{formatAlertTime(a.generated_at)}</span>
        </div>

        {isSocial && (
          <div className="social-warning-bar">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 1 21h22z" /><path d="M12 9v5M12 18v.5" />
            </svg>
            SOCIAL MEDIA — UNVERIFIED REPORT — Cross-reference with official sources
          </div>
        )}

        <div className="alert-headline">{a.headline}</div>
        {!compact && <div className="alert-summary">{a.summary}</div>}

        <div className="alert-tags-row">
          <SourceTypeBadge sourceType={a.source_type} socialPlatform={a.social_platform} />
          <RuleBadge ruleName={a.rule_name} />
        </div>

        <div className="alert-footer">
          <span className="alert-source">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            {a.source}
          </span>
          {a.content_url && (
            <a href={a.content_url} target="_blank" rel="noreferrer" className="alert-link">
              View source
            </a>
          )}
          <span className="alert-stamp">{formatAlertStamp(a.generated_at)}</span>
        </div>

        <div className="alert-actions">
          {onViewDetail && (
            <button className="alert-action" onClick={() => onViewDetail(a)}>
              Detail
            </button>
          )}
          {a.fire_id && onSelectFire && (
            <button className="alert-action" onClick={() => onSelectFire(a.fire_id)}>
              Incident
            </button>
          )}
          {!a.acknowledged ? (
            <button className="alert-action" onClick={() => onAcknowledge(a.id)}>
              Acknowledge
            </button>
          ) : (
            <span className="alert-ack-label">Acknowledged</span>
          )}
          <button className="alert-action danger" onClick={() => onDelete(a.id)}>
            Dismiss
          </button>
        </div>
      </div>
    </li>
  )
}

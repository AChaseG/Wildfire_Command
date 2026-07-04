import { useMemo, useState } from 'react'
import { ALERT_SEVERITY } from '../lib/alertUtils'
import AlertCard from './AlertCard'
import { PLATFORMS } from './AddSocialAlertModal'

function FeedSection({ title, subtitle, color, icon, alerts, onAcknowledge, onDelete, onSelectFire, onViewDetail, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const unack = alerts.filter((a) => !a.acknowledged).length

  return (
    <div className="feed-section">
      <button
        className="feed-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="feed-section-icon" style={{ color: color || 'var(--text-muted)' }}>
          {icon}
        </span>
        <span className="feed-section-title">{title}</span>
        {subtitle && <span className="feed-section-sub">{subtitle}</span>}
        <span className="feed-section-meta">
          {unack > 0 && <span className="feed-count-badge">{unack}</span>}
          <span className="feed-section-count">{alerts.length}</span>
          <svg
            viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && alerts.length > 0 && (
        <ol className="alerts-list feed-section-list">
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onAcknowledge={onAcknowledge}
              onDelete={onDelete}
              onSelectFire={onSelectFire}
              onViewDetail={onViewDetail}
            />
          ))}
        </ol>
      )}
      {open && alerts.length === 0 && (
        <div className="feed-empty">No alerts in this feed.</div>
      )}
    </div>
  )
}

function RuleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
    </svg>
  )
}

function SocialIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M17 8a3 3 0 0 1 0 6M21 20a6 6 0 0 0-6-6" />
    </svg>
  )
}

function RSSIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="6.18" cy="17.82" r="2.18" />
      <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z" />
    </svg>
  )
}

export default function CustomFeedsPane({ alerts, rules, onAcknowledge, onDelete, onSelectFire, onViewDetail, onOpenRules }) {
  // Group 1: By custom rule (rules that have alerts)
  const ruleFeeds = useMemo(() => {
    return rules
      .map((rule) => ({
        rule,
        alerts: alerts.filter((a) => a.rule_id === rule.id),
      }))
      .filter((f) => f.alerts.length > 0)
  }, [alerts, rules])

  // Group 2: Social media alerts grouped by platform
  const socialAlerts = useMemo(
    () => alerts.filter((a) => a.source_type === 'social'),
    [alerts],
  )
  const socialByPlatform = useMemo(() => {
    return PLATFORMS.map((p) => ({
      platform: p,
      alerts: socialAlerts.filter((a) => a.social_platform === p.value),
    })).filter((g) => g.alerts.length > 0)
  }, [socialAlerts])

  // Group 3: RSS/external feed alerts
  const rssAlerts = useMemo(
    () => alerts.filter((a) => a.source_type === 'rss'),
    [alerts],
  )

  // Group 4: Manual alerts
  const manualAlerts = useMemo(
    () => alerts.filter((a) => a.source_type === 'manual'),
    [alerts],
  )

  const totalAlerts = alerts.length
  const totalUnack = alerts.filter((a) => !a.acknowledged).length

  return (
    <div className="custom-feeds-pane">
      <div className="feeds-head">
        <div className="feeds-title-row">
          <h3>
            Custom Feeds
            {totalUnack > 0 && <span className="alerts-badge">{totalUnack}</span>}
          </h3>
          <button className="rules-btn" onClick={onOpenRules}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
            </svg>
            Manage rules
          </button>
        </div>
        <p className="feeds-sub">
          {totalAlerts} alert{totalAlerts === 1 ? '' : 's'} across {ruleFeeds.length} rule feed{ruleFeeds.length === 1 ? '' : 's'}
          {socialAlerts.length > 0 && `, ${socialAlerts.length} social media report${socialAlerts.length === 1 ? '' : 's'}`}
          {rssAlerts.length > 0 && `, ${rssAlerts.length} RSS import${rssAlerts.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="feeds-body">
        {ruleFeeds.length === 0 && socialAlerts.length === 0 && rssAlerts.length === 0 && manualAlerts.length === 0 && (
          <div className="feeds-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
            </svg>
            <p>No custom feeds yet.</p>
            <p className="feeds-empty-hint">Create alert rules to build rule-based feeds, add social media reports, or fetch RSS data.</p>
            <button className="btn-primary" onClick={onOpenRules}>Create alert rules</button>
          </div>
        )}

        {/* Rule-based feeds */}
        {ruleFeeds.length > 0 && (
          <div className="feeds-group">
            <div className="feeds-group-label">
              <RuleIcon /> Rule-based feeds ({ruleFeeds.length})
            </div>
            {ruleFeeds.map(({ rule, alerts: rAlerts }) => {
              const sev = ALERT_SEVERITY[rule.alert_severity] || ALERT_SEVERITY.low
              const geoLabel = rule.geo_type === 'polygon' ? ' · Polygon area' : rule.geo_type === 'radius' ? ' · Radius area' : ''
              return (
                <FeedSection
                  key={rule.id}
                  title={rule.name}
                  subtitle={`${rule.alert_severity.toUpperCase()}${geoLabel}`}
                  color={sev.color}
                  icon={<RuleIcon />}
                  alerts={rAlerts}
                  onAcknowledge={onAcknowledge}
                  onDelete={onDelete}
                  onSelectFire={onSelectFire}
                  onViewDetail={onViewDetail}
                  defaultOpen={rAlerts.some((a) => !a.acknowledged)}
                />
              )
            })}
          </div>
        )}

        {/* Social media feeds */}
        {socialAlerts.length > 0 && (
          <div className="feeds-group">
            <div className="feeds-group-label">
              <SocialIcon /> Social media reports — unverified ({socialAlerts.length})
            </div>
            <div className="social-feed-disclaimer">
              Reports from social media are <strong>not verified</strong> by official agencies. Use only as supplementary awareness. Always cross-reference with official sources.
            </div>
            {socialByPlatform.map(({ platform, alerts: pAlerts }) => (
              <FeedSection
                key={platform.value}
                title={platform.label}
                subtitle={`${pAlerts.length} report${pAlerts.length === 1 ? '' : 's'}`}
                color={platform.color}
                icon={<SocialIcon />}
                alerts={pAlerts}
                onAcknowledge={onAcknowledge}
                onDelete={onDelete}
                onSelectFire={onSelectFire}
                onViewDetail={onViewDetail}
                defaultOpen={false}
              />
            ))}
          </div>
        )}

        {/* RSS / external feeds */}
        {rssAlerts.length > 0 && (
          <div className="feeds-group">
            <div className="feeds-group-label">
              <RSSIcon /> RSS / External imports ({rssAlerts.length})
            </div>
            <FeedSection
              title="GDACS Global Alerts"
              subtitle="gdacs.org RSS feed"
              color="var(--info)"
              icon={<RSSIcon />}
              alerts={rssAlerts}
              onAcknowledge={onAcknowledge}
              onDelete={onDelete}
              onSelectFire={onSelectFire}
              onViewDetail={onViewDetail}
              defaultOpen={rssAlerts.some((a) => !a.acknowledged)}
            />
          </div>
        )}

        {/* Manual alerts */}
        {manualAlerts.length > 0 && (
          <div className="feeds-group">
            <div className="feeds-group-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Manual entries ({manualAlerts.length})
            </div>
            <FeedSection
              title="Manually added alerts"
              color="var(--text-muted)"
              icon={null}
              alerts={manualAlerts}
              onAcknowledge={onAcknowledge}
              onDelete={onDelete}
              onSelectFire={onSelectFire}
              onViewDetail={onViewDetail}
              defaultOpen={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}

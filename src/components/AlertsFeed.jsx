import { useMemo, useState } from 'react'
import { SEVERITY_FILTERS, CATEGORY_FILTERS } from '../lib/alertUtils'
import AlertCard from './AlertCard'

const SOURCE_TYPE_FILTERS = [
  { key: 'all', label: 'All sources' },
  { key: 'native', label: 'Rule-generated' },
  { key: 'social', label: 'Social media' },
  { key: 'rss', label: 'RSS / External' },
  { key: 'manual', label: 'Manual' },
]

export default function AlertsFeed({
  alerts,
  loading,
  error,
  onAcknowledge,
  onAcknowledgeAll,
  onDelete,
  onOpenRules,
  onAddSocial,
  onFetchExternal,
  onSelectFire,
  onViewDetail,
  unackCount,
  fetchingExternal,
}) {
  const [sevFilter, setSevFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [srcFilter, setSrcFilter] = useState('all')
  const [showAck, setShowAck] = useState(false)

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (!showAck && a.acknowledged) return false
      if (sevFilter !== 'all' && a.severity !== sevFilter) return false
      if (catFilter !== 'all' && a.category !== catFilter) return false
      if (srcFilter !== 'all' && a.source_type !== srcFilter) return false
      return true
    })
  }, [alerts, sevFilter, catFilter, srcFilter, showAck])

  const socialCount = useMemo(() => alerts.filter((a) => a.source_type === 'social').length, [alerts])
  const rssCount = useMemo(() => alerts.filter((a) => a.source_type === 'rss').length, [alerts])

  return (
    <div className="alerts-feed">
      <div className="alerts-head">
        <div className="alerts-title-row">
          <h3>
            Alerts
            {unackCount > 0 && <span className="alerts-badge">{unackCount}</span>}
          </h3>
          <div className="alerts-head-actions">
            <button className="rules-btn" onClick={onOpenRules}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
              </svg>
              Rules
            </button>
            <button className="rules-btn social" onClick={onAddSocial}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3" />
                <path d="M3 20a6 6 0 0 1 12 0M16 5h6M19 2v6" />
              </svg>
              Social
            </button>
            <button className="rules-btn rss" onClick={onFetchExternal} disabled={fetchingExternal} title="Scan all sources now (auto-scans every 2 min)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <circle cx="6.18" cy="17.82" r="2.18" />
                <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z" />
              </svg>
              {fetchingExternal ? 'Scanning…' : 'Scan now'}
            </button>
          </div>
        </div>

        {(socialCount > 0 || rssCount > 0) && (
          <div className="feed-source-summary">
            {socialCount > 0 && (
              <span className="feed-src-chip social">
                {socialCount} social media report{socialCount === 1 ? '' : 's'} — unverified
              </span>
            )}
            {rssCount > 0 && (
              <span className="feed-src-chip rss">
                {rssCount} RSS import{rssCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}

        <div className="alerts-actions">
          <button className="feed-action" onClick={() => setShowAck((v) => !v)}>
            {showAck ? 'Hide acknowledged' : 'Show acknowledged'}
          </button>
          {unackCount > 0 && (
            <button className="feed-action primary" onClick={onAcknowledgeAll}>
              Acknowledge all ({unackCount})
            </button>
          )}
        </div>
      </div>

      <div className="alerts-filters">
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="alert-select">
          {SEVERITY_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="alert-select">
          {CATEGORY_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)} className="alert-select">
          {SOURCE_TYPE_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {loading && <div className="alerts-status">Loading alerts…</div>}
      {error && <div className="alerts-status error">Failed to load: {error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="alerts-status empty">
          {alerts.length === 0
            ? 'No alerts yet. Create alert rules, add a social media report, or fetch RSS to populate the feed.'
            : 'No alerts match the current filters.'}
        </div>
      )}

      <ol className="alerts-list">
        {filtered.map((a) => (
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
    </div>
  )
}

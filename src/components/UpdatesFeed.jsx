import { CATEGORY_META, formatDateTime, formatRelative } from '../lib/fireUtils'

const CATEGORY_COLORS = {
  containment: '#3fb950',
  evacuation: '#f85149',
  weather: '#58a6ff',
  air_quality: '#a371f7',
  crews: '#f0a020',
  general: '#6b7280',
}

export default function UpdatesFeed({ updates, loading, error }) {
  if (loading) {
    return (
      <div className="updates-feed">
        <h3 className="feed-title">Incident Updates</h3>
        <div className="feed-loading">Loading updates…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="updates-feed">
        <h3 className="feed-title">Incident Updates</h3>
        <div className="feed-error">Failed to load updates: {error}</div>
      </div>
    )
  }

  if (!updates || updates.length === 0) {
    return (
      <div className="updates-feed">
        <h3 className="feed-title">Incident Updates</h3>
        <div className="feed-empty">No updates have been posted for this incident yet.</div>
      </div>
    )
  }

  return (
    <div className="updates-feed">
      <h3 className="feed-title">
        Incident Updates
        <span className="feed-count">{updates.length}</span>
      </h3>
      <ol className="feed-timeline">
        {updates.map((u) => {
          const cat = CATEGORY_META[u.category] || CATEGORY_META.general
          const color = CATEGORY_COLORS[u.category] || CATEGORY_COLORS.general
          return (
            <li key={u.id} className="feed-item">
              <span className="feed-dot" style={{ background: color }} />
              <div className="feed-content">
                <div className="feed-meta">
                  <span className="feed-category" style={{ color }}>{cat.label}</span>
                  <span className="feed-time" title={formatDateTime(u.posted_at)}>
                    {formatRelative(u.posted_at)}
                  </span>
                </div>
                <div className="feed-headline">{u.title}</div>
                <div className="feed-body">{u.content}</div>
                <div className="feed-stamp">{formatDateTime(u.posted_at)}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

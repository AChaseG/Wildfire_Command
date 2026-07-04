import { useState } from 'react'

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', color: '#1877f2' },
  { value: 'twitter', label: 'X (Twitter)', color: '#1da1f2' },
  { value: 'instagram', label: 'Instagram', color: '#e1306c' },
  { value: 'nextdoor', label: 'Nextdoor', color: '#8bc34a' },
  { value: 'youtube', label: 'YouTube', color: '#ff0000' },
  { value: 'other', label: 'Other / Unknown', color: '#6b7280' },
]

const SEVERITY_OPTIONS = [
  { value: 'flash', label: 'Flash — confirmed life-threatening' },
  { value: 'urgent', label: 'Urgent — critical action needed' },
  { value: 'high', label: 'High — significant impact' },
  { value: 'medium', label: 'Medium — notable development' },
  { value: 'low', label: 'Low — informational' },
]

const CATEGORY_OPTIONS = [
  { value: 'wildfire', label: 'Wildfire' },
  { value: 'air_quality', label: 'Air Quality' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'weather', label: 'Weather' },
  { value: 'containment', label: 'Containment' },
  { value: 'general', label: 'General' },
]

const EMPTY = {
  platform: 'facebook',
  headline: '',
  summary: '',
  content_url: '',
  severity: 'medium',
  category: 'wildfire',
}

export default function AddSocialAlertModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) return null

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const platformMeta = PLATFORMS.find((p) => p.value === form.platform) || PLATFORMS[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.headline.trim()) { setErr('Headline is required.'); return }
    if (!form.summary.trim()) { setErr('Report content is required.'); return }
    setSaving(true)
    const result = await onCreate({
      headline: form.headline.trim(),
      summary: form.summary.trim(),
      severity: form.severity,
      category: form.category,
      source: `${platformMeta.label} (social media)`,
      source_type: 'social',
      social_platform: form.platform,
      content_url: form.content_url?.trim() || null,
      generated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (result) {
      setForm(EMPTY)
      onClose()
    } else {
      setErr('Failed to save alert.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Add Social Media Report</h2>
            <p className="modal-sub">
              Manually enter a report observed on social media. All social media alerts are clearly labeled as unverified and may not reflect confirmed conditions.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="social-disclaimer">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2 1 21h22z" /><path d="M12 9v5M12 18v.5" />
          </svg>
          Social media reports are <strong>not verified</strong> by official agencies. Use only as supplementary situational awareness. Always cross-reference with official sources before taking action.
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="rule-form">
            <div className="form-grid">
              <label className="form-label">
                Platform
                <div className="platform-select-wrap">
                  <select
                    value={form.platform}
                    onChange={(e) => set('platform', e.target.value)}
                    className="form-select"
                    style={{ borderColor: platformMeta.color }}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <span className="platform-dot" style={{ background: platformMeta.color }} />
                </div>
              </label>

              <label className="form-label">
                Severity
                <select value={form.severity} onChange={(e) => set('severity', e.target.value)} className="form-select">
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Category
                <select value={form.category} onChange={(e) => set('category', e.target.value)} className="form-select">
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Post URL (optional)
                <input
                  type="url"
                  value={form.content_url}
                  onChange={(e) => set('content_url', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="form-input"
                />
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                Headline
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => set('headline', e.target.value)}
                  placeholder="Brief description of the report"
                  className="form-input"
                  maxLength={200}
                />
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                Report content
                <textarea
                  value={form.summary}
                  onChange={(e) => set('summary', e.target.value)}
                  placeholder="Paste the social media post text or describe what was reported…"
                  className="form-input form-textarea"
                  rows={4}
                  maxLength={1000}
                />
              </label>
            </div>

            {err && <div className="form-error">{err}</div>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Add social media alert'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export { PLATFORMS }

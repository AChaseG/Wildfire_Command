import { useState } from 'react'
import { ALERT_SEVERITY } from '../lib/alertUtils'
import RuleMap from './RuleMap'

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'extreme', label: 'Extreme' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'contained', label: 'Contained' },
  { value: 'controlled', label: 'Controlled' },
  { value: 'out', label: 'Out' },
]

const ALERT_SEV_OPTIONS = [
  { value: 'flash', label: 'Flash' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const CATEGORY_OPTIONS = [
  { value: 'wildfire', label: 'Wildfire' },
  { value: 'air_quality', label: 'Air Quality' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'weather', label: 'Weather' },
  { value: 'containment', label: 'Containment' },
  { value: 'general', label: 'General' },
]

const EMPTY_FORM = {
  name: '',
  severity_min: '',
  aqi_min: '',
  containment_max: '',
  status: '',
  keyword: '',
  alert_severity: 'high',
  category: 'wildfire',
  geo_type: null,
  geo_polygon: null,
  geo_center_lat: null,
  geo_center_lng: null,
  geo_radius_m: null,
}

export default function AlertRulesModal({ open, onClose, rules, loading, onCreate, onUpdate, onDelete, onGenerate, fires }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [genResult, setGenResult] = useState(null)
  const [err, setErr] = useState(null)

  if (!open) return null

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleGeoChange = (geoUpdates) => {
    setForm((prev) => ({ ...prev, ...geoUpdates }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('Rule name is required.')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      severity_min: form.severity_min || null,
      aqi_min: form.aqi_min ? parseInt(form.aqi_min, 10) : null,
      containment_max: form.containment_max ? parseInt(form.containment_max, 10) : null,
      status: form.status || null,
      keyword: form.keyword?.trim() || null,
      alert_severity: form.alert_severity,
      category: form.category,
      enabled: true,
      geo_type: form.geo_type || null,
      geo_polygon: form.geo_polygon,
      geo_center_lat: form.geo_center_lat,
      geo_center_lng: form.geo_center_lng,
      geo_radius_m: form.geo_radius_m,
    }
    const result = await onCreate(payload)
    setSaving(false)
    if (result) {
      setForm(EMPTY_FORM)
    } else {
      setErr('Failed to create rule.')
    }
  }

  const toggleEnabled = async (rule) => {
    await onUpdate(rule.id, { enabled: !rule.enabled })
  }

  const handleGenerate = async (rule) => {
    setGenerating(rule.id)
    setGenResult(null)
    const count = await onGenerate(rule, fires)
    setGenerating(null)
    setGenResult({ ruleId: rule.id, count })
    setTimeout(() => setGenResult(null), 4000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Alert Rules</h2>
            <p className="modal-sub">
              Define conditions that generate alerts from wildfire data. Add geographic filters to scope alerts to a drawn polygon or radius around a location.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <form className="rule-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">
                Rule name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. Extreme fires near populated areas"
                  className="form-input"
                />
              </label>
            </div>

            <div className="form-grid">
              <label className="form-label">
                Min fire severity
                <select value={form.severity_min} onChange={(e) => update('severity_min', e.target.value)} className="form-select">
                  <option value="">Any severity</option>
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Min AQI
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={form.aqi_min}
                  onChange={(e) => update('aqi_min', e.target.value)}
                  placeholder="e.g. 150"
                  className="form-input"
                />
              </label>

              <label className="form-label">
                Max containment %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.containment_max}
                  onChange={(e) => update('containment_max', e.target.value)}
                  placeholder="e.g. 25"
                  className="form-input"
                />
              </label>

              <label className="form-label">
                Fire status
                <select value={form.status} onChange={(e) => update('status', e.target.value)} className="form-select">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Keyword
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => update('keyword', e.target.value)}
                  placeholder="e.g. evacuation"
                  className="form-input"
                />
              </label>

              <label className="form-label">
                Alert severity
                <select value={form.alert_severity} onChange={(e) => update('alert_severity', e.target.value)} className="form-select">
                  {ALERT_SEV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Alert category
                <select value={form.category} onChange={(e) => update('category', e.target.value)} className="form-select">
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-section-divider">
              <span>Geographic filter (optional)</span>
            </div>
            <RuleMap
              geoType={form.geo_type}
              polygon={form.geo_polygon}
              center={form.geo_center_lat != null ? { lat: form.geo_center_lat, lng: form.geo_center_lng } : null}
              radiusM={form.geo_radius_m}
              onChange={handleGeoChange}
            />

            {err && <div className="form-error">{err}</div>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY_FORM)}>
                Reset
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create rule'}
              </button>
            </div>
          </form>

          <div className="rules-list-section">
            <h3 className="rules-list-title">Existing rules ({rules.length})</h3>
            {loading && <div className="rules-status">Loading…</div>}
            {!loading && rules.length === 0 && (
              <div className="rules-status">No rules yet. Create one above.</div>
            )}
            <ul className="rules-list">
              {rules.map((rule) => {
                const sev = ALERT_SEVERITY[rule.alert_severity] || ALERT_SEVERITY.low
                const conditions = []
                if (rule.severity_min) conditions.push(`severity ≥ ${rule.severity_min}`)
                if (rule.aqi_min) conditions.push(`AQI ≥ ${rule.aqi_min}`)
                if (rule.containment_max != null) conditions.push(`containment ≤ ${rule.containment_max}%`)
                if (rule.status) conditions.push(`status = ${rule.status}`)
                if (rule.keyword) conditions.push(`keyword "${rule.keyword}"`)
                if (rule.geo_type === 'polygon') conditions.push('polygon area')
                if (rule.geo_type === 'radius') conditions.push('radius area')
                return (
                  <li key={rule.id} className={`rule-item ${rule.enabled ? '' : 'disabled'}`}>
                    <div className="rule-item-main">
                      <div className="rule-item-head">
                        <span className="rule-sev-dot" style={{ background: sev.color }} />
                        <span className="rule-name">{rule.name}</span>
                        <span className="rule-tag" style={{ color: sev.color, borderColor: sev.color }}>
                          {sev.label}
                        </span>
                      </div>
                      <div className="rule-conditions">
                        {conditions.length > 0 ? conditions.join(' · ') : 'Matches all fires'}
                      </div>
                      {genResult && genResult.ruleId === rule.id && (
                        <div className="rule-gen-result">
                          Generated {genResult.count} alert{genResult.count === 1 ? '' : 's'}
                        </div>
                      )}
                    </div>
                    <div className="rule-item-actions">
                      <button
                        className="rule-gen-btn"
                        onClick={() => handleGenerate(rule)}
                        disabled={generating === rule.id}
                        title="Generate alerts now"
                      >
                        {generating === rule.id ? '…' : 'Run'}
                      </button>
                      <button
                        className="rule-toggle"
                        onClick={() => toggleEnabled(rule)}
                        aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        <span className={`toggle-track ${rule.enabled ? 'on' : ''}`}>
                          <span className="toggle-thumb" />
                        </span>
                      </button>
                      <button className="rule-delete" onClick={() => onDelete(rule.id)} aria-label="Delete rule">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

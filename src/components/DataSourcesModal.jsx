import { useMemo, useState } from 'react'
import { SOURCE_CATEGORIES, CATEGORY_ORDER, categoryMeta } from '../lib/sourceUtils'
import { parseKml, countGeometries } from '../lib/kmlUtils'

function CategoryIcon({ name }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
        </svg>
      )
    case 'fire':
      return (
        <svg {...common}>
          <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" />
        </svg>
      )
    case 'radio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" />
          <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M5 5a10 10 0 0 0 0 14M19 19a10 10 0 0 0 0-14" />
        </svg>
      )
    case 'social':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0M16 5h6M19 2v6" />
        </svg>
      )
    case 'people':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0M17 8a3 3 0 0 1 0 6M21 20a6 6 0 0 0-6-6" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z M4 8h16 M8 4v16" />
        </svg>
      )
  }
}

const EMPTY_FORM = {
  name: '',
  url: '',
  category: 'official',
  description: '',
}

const VERIFY_META = {
  ok: { label: 'Reachable', color: '#3fb950' },
  unreachable: { label: 'No data', color: '#f85149' },
  error: { label: 'Error', color: '#f0a020' },
  pending: { label: 'Checking…', color: '#58a6ff' },
}

function VerifyBadge({ source, onRecheck }) {
  if (source.source_kind === 'kml') return null
  const status = source.verify_status
  const meta = status ? VERIFY_META[status] : null
  const title = source.verify_detail
    || (status ? '' : 'Not yet checked — click to verify data can be pulled.')
  return (
    <button
      type="button"
      className={`verify-badge ${status || 'unchecked'}`}
      style={meta ? { color: meta.color, borderColor: `${meta.color}66` } : undefined}
      onClick={() => onRecheck(source)}
      disabled={status === 'pending'}
      title={title}
    >
      {status === 'pending' ? (
        <span className="verify-spinner" aria-hidden="true" />
      ) : status === 'ok' ? (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      ) : status === 'unreachable' || status === 'error' ? (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 1 21h22L12 2zM12 9v5M12 17h.01" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /><path d="M21 4v5h-5" /></svg>
      )}
      {meta ? meta.label : 'Check'}
    </button>
  )
}

export default function DataSourcesModal({ open, onClose, sources, loading, onCreate, onUpdate, onDelete, onVerify }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [mode, setMode] = useState('url')
  const [kml, setKml] = useState({ content: null, features: 0, fileName: '', error: null })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  // Geometry counts for KML sources, parsed once per source list change.
  const kmlCounts = useMemo(() => {
    const map = {}
    for (const s of sources) {
      if (s.source_kind === 'kml' && s.kml_content) {
        map[s.id] = countGeometries(parseKml(s.kml_content).features)
      }
    }
    return map
  }, [sources])

  if (!open) return null

  const isEditing = editingId !== null
  const editingKml = isEditing && mode === 'kml'

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setMode('url')
    setKml({ content: null, features: 0, fileName: '', error: null })
    setEditingId(null)
    setErr(null)
  }

  const startEdit = (source) => {
    setEditingId(source.id)
    setErr(null)
    setMode(source.source_kind === 'kml' ? 'kml' : 'url')
    setKml({ content: null, features: 0, fileName: '', error: null })
    setForm({
      name: source.name || '',
      url: source.url || '',
      category: source.category || 'official',
      description: source.description || '',
    })
  }

  const handleFile = async (file) => {
    if (!file) return
    if (!/\.kml$/i.test(file.name)) {
      setKml({ content: null, features: 0, fileName: '', error: 'Please choose a .kml file.' })
      return
    }
    const text = await file.text()
    const { features, error } = parseKml(text)
    if (error) {
      setKml({ content: null, features: 0, fileName: file.name, error })
      return
    }
    setKml({ content: text, features: countGeometries(features), fileName: file.name, error: null })
    if (!form.name.trim()) {
      update('name', file.name.replace(/\.kml$/i, ''))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(null)

    if (mode === 'kml') {
      if (!form.name.trim()) {
        setErr('A name is required.')
        return
      }
      if (!isEditing && !kml.content) {
        setErr('Choose a valid KML file to upload.')
        return
      }
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description?.trim() || null,
        source_kind: 'kml',
      }
      if (kml.content) {
        payload.kml_content = kml.content
        payload.url = `kml://${kml.fileName || form.name.trim()}`
      }
      setSaving(true)
      const result = isEditing
        ? await onUpdate(editingId, payload)
        : await onCreate({ ...payload, enabled: true, is_default: false, visible: true })
      setSaving(false)
      if (result) resetForm()
      else setErr(isEditing ? 'Failed to save changes.' : 'Failed to add KML source.')
      return
    }

    if (!form.name.trim() || !form.url.trim()) {
      setErr('Name and URL are required.')
      return
    }
    let url = form.url.trim()
    if (!url.startsWith('http')) url = `https://${url}`
    const payload = {
      name: form.name.trim(),
      url,
      category: form.category,
      description: form.description?.trim() || null,
    }
    setSaving(true)
    const result = isEditing
      ? await onUpdate(editingId, payload)
      : await onCreate({ ...payload, source_kind: 'url', enabled: true, is_default: false })
    setSaving(false)
    if (result) {
      // Automatically confirm data can be pulled from the source's URL.
      if (onVerify && result.id) onVerify(result.id, result.url || url)
      resetForm()
    } else {
      setErr(isEditing ? 'Failed to save changes.' : 'Failed to add source.')
    }
  }

  const recheck = (source) => {
    if (onVerify && source.url) onVerify(source.id, source.url)
  }

  const toggleEnabled = async (source) => {
    await onUpdate(source.id, { enabled: !source.enabled })
  }

  const toggleVisible = async (source) => {
    await onUpdate(source.id, { visible: source.visible === false })
  }

  const handleDelete = (source) => {
    const msg = source.is_default
      ? `Delete the built-in source "${source.name}"? This cannot be undone.`
      : `Delete "${source.name}"?`
    if (window.confirm(msg)) {
      if (editingId === source.id) resetForm()
      onDelete(source.id)
    }
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: sources.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Data Sources</h2>
            <p className="modal-sub">
              Manage the external data sources the tool retrieves wildfire and emergency information from. Add web feeds or upload KML files to overlay on the map.
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
            <h3 className="form-section-title">{isEditing ? 'Edit data source' : 'Add a data source'}</h3>

            {!isEditing && (
              <div className="source-mode-toggle" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'url'}
                  className={`source-mode-btn ${mode === 'url' ? 'active' : ''}`}
                  onClick={() => setMode('url')}
                >
                  Web feed / URL
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'kml'}
                  className={`source-mode-btn ${mode === 'kml' ? 'active' : ''}`}
                  onClick={() => setMode('kml')}
                >
                  KML file
                </button>
              </div>
            )}

            <div className="form-grid">
              <label className="form-label">
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder={mode === 'kml' ? 'e.g. Evacuation Zones' : 'e.g. Local Fire Department'}
                  className="form-input"
                />
              </label>

              {mode === 'url' ? (
                <label className="form-label">
                  URL
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => update('url', e.target.value)}
                    placeholder="https://example.com"
                    className="form-input"
                  />
                </label>
              ) : (
                <label className="form-label">
                  {editingKml ? 'Replace KML file (optional)' : 'KML file'}
                  <input
                    type="file"
                    accept=".kml,application/vnd.google-earth.kml+xml"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    className="form-input file-input"
                  />
                </label>
              )}

              <label className="form-label">
                Category
                <select value={form.category} onChange={(e) => update('category', e.target.value)} className="form-select">
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>{SOURCE_CATEGORIES[cat].label}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Description
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="What this source provides"
                  className="form-input"
                />
              </label>
            </div>

            {mode === 'kml' && kml.error && <div className="form-error">{kml.error}</div>}
            {mode === 'kml' && kml.content && (
              <div className="kml-parse-note">
                Parsed <strong>{kml.features}</strong> geometr{kml.features === 1 ? 'y' : 'ies'} from {kml.fileName}. It will be drawn on the map.
              </div>
            )}

            {err && <div className="form-error">{err}</div>}
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={resetForm}>
                {isEditing ? 'Cancel' : 'Reset'}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save changes' : mode === 'kml' ? 'Add KML overlay' : 'Add source'}
              </button>
            </div>
          </form>

          <div className="rules-list-section">
            <h3 className="rules-list-title">
              Configured sources ({sources.length})
            </h3>
            {loading && <div className="rules-status">Loading…</div>}
            {!loading && sources.length === 0 && (
              <div className="rules-status">No sources configured.</div>
            )}

            {grouped.map((group) => {
              const meta = categoryMeta(group.category)
              return (
                <div key={group.category} className="source-group">
                  <div className="source-group-head">
                    <span className="source-group-icon" style={{ color: meta.color }}>
                      <CategoryIcon name={meta.icon} />
                    </span>
                    <span className="source-group-label">{meta.label}</span>
                    <span className="source-group-count">{group.items.length}</span>
                  </div>
                  <ul className="source-list">
                    {group.items.map((source) => {
                      const isKml = source.source_kind === 'kml'
                      return (
                        <li key={source.id} className={`source-item ${(isKml ? source.visible !== false : source.enabled) ? '' : 'disabled'} ${editingId === source.id ? 'editing' : ''}`}>
                          <div className="source-item-main">
                            <div className="source-item-head">
                              <span className="source-name">{source.name}</span>
                              {source.is_default && <span className="source-badge">Built-in</span>}
                              {isKml && <span className="source-badge kml">KML</span>}
                            </div>
                            {isKml ? (
                              <div className="source-url kml-meta">
                                {kmlCounts[source.id] ?? 0} geometr{kmlCounts[source.id] === 1 ? 'y' : 'ies'} · {source.visible === false ? 'hidden on map' : 'shown on map'}
                              </div>
                            ) : (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="source-url"
                              >
                                {source.url}
                              </a>
                            )}
                            {!isKml && (
                              <div className="source-verify-row">
                                <VerifyBadge source={source} onRecheck={recheck} />
                                {source.verify_detail && (
                                  <span className="source-verify-detail">{source.verify_detail}</span>
                                )}
                              </div>
                            )}
                            {source.description && (
                              <div className="source-desc">{source.description}</div>
                            )}
                          </div>
                          <div className="source-item-actions">
                            <button
                              className="rule-toggle"
                              onClick={() => (isKml ? toggleVisible(source) : toggleEnabled(source))}
                              aria-label={
                                isKml
                                  ? (source.visible === false ? 'Show overlay on map' : 'Hide overlay on map')
                                  : (source.enabled ? 'Disable source' : 'Enable source')
                              }
                              title={isKml ? 'Show / hide this overlay on the map' : 'Enable / disable this source'}
                            >
                              <span className={`toggle-track ${(isKml ? source.visible !== false : source.enabled) ? 'on' : ''}`}>
                                <span className="toggle-thumb" />
                              </span>
                            </button>
                            <button
                              className="source-edit"
                              onClick={() => startEdit(source)}
                              aria-label="Edit source"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                            <button
                              className="rule-delete"
                              onClick={() => handleDelete(source)}
                              aria-label="Delete source"
                              title={source.is_default ? 'Delete built-in source' : 'Delete source'}
                            >
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

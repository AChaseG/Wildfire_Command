import { useState } from 'react'

const COLORS = ['#f0a020', '#f85149', '#3fb950', '#58a6ff', '#e040fb', '#ff6b6b', '#26c6da']


const EMPTY = { name: '', description: '', latitude: '', longitude: '', color: COLORS[0] }

export default function KeyLocationsModal({ open, onClose, locations, loading, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) return null

  const set = (field, val) => setForm((p) => ({ ...p, [field]: val }))

  const handleEdit = (loc) => {
    setEditing(loc.id)
    setForm({
      name: loc.name,
      description: loc.description || '',
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      color: loc.color || COLORS[0],
    })
    setErr(null)
  }

  const handleCancel = () => {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) { setErr('Name is required.'); return }
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    if (isNaN(lat) || lat < -90 || lat > 90) { setErr('Enter a valid latitude (-90 to 90).'); return }
    if (isNaN(lng) || lng < -180 || lng > 180) { setErr('Enter a valid longitude (-180 to 180).'); return }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      latitude: lat,
      longitude: lng,
      color: form.color,
    }
    let result
    if (editing) {
      result = await onUpdate(editing, payload)
    } else {
      result = await onCreate(payload)
    }
    setSaving(false)
    if (result) {
      handleCancel()
    } else {
      setErr('Failed to save location.')
    }
  }

  const handleDelete = async (id) => {
    await onDelete(id)
    if (editing === id) handleCancel()
  }

  const toggleVisible = (loc) => {
    onUpdate(loc.id, { visible: loc.visible === false })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal kl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Key Locations</h2>
            <p className="modal-sub">Save named points of interest. The app automatically shows distances from fire incidents to each location.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="kl-modal-body">
          {/* Saved list */}
          <div className="kl-list-wrap">
            <div className="kl-list-head">Saved locations ({locations.length})</div>
            {loading && <div className="kl-empty">Loading…</div>}
            {!loading && locations.length === 0 && (
              <div className="kl-empty">No key locations saved yet.</div>
            )}
            <div className="kl-list">
              {locations.map((loc) => {
                const isHidden = loc.visible === false
                return (
                <div key={loc.id} className={`kl-item ${editing === loc.id ? 'editing' : ''} ${isHidden ? 'hidden-loc' : ''}`}>
                  <span className="kl-dot" style={{ background: loc.color }} />
                  <div className="kl-item-info">
                    <div className="kl-item-name">{loc.name}</div>
                    <div className="kl-item-coords">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </div>
                    {loc.description && <div className="kl-item-desc">{loc.description}</div>}
                  </div>
                  <div className="kl-item-actions">
                    <button
                      className={`kl-action ${isHidden ? '' : 'on'}`}
                      onClick={() => toggleVisible(loc)}
                      title={isHidden ? 'Show on map' : 'Hide from map'}
                      aria-label={isHidden ? 'Show on map' : 'Hide from map'}
                    >
                      {isHidden ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                    <button className="kl-action" onClick={() => handleEdit(loc)}>Edit</button>
                    <button className="kl-action danger" onClick={() => handleDelete(loc.id)}>Delete</button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          {/* Form */}
          <div className="kl-form-wrap">
            <div className="kl-form-title">{editing ? 'Edit location' : 'Add new location'}</div>
            <form onSubmit={handleSubmit} className="kl-form">
              <label className="form-label">
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Home, Evacuation Point, Station 12…"
                  className="form-input"
                  maxLength={80}
                />
              </label>
              <label className="form-label">
                Description (optional)
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Brief notes"
                  className="form-input"
                  maxLength={200}
                />
              </label>
              <div className="kl-coords-row">
                <label className="form-label">
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => set('latitude', e.target.value)}
                    placeholder="47.3523"
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => set('longitude', e.target.value)}
                    placeholder="-120.4056"
                    className="form-input"
                  />
                </label>
              </div>
              <label className="form-label">
                Color
                <div className="kl-colors">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`kl-color-btn ${form.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => set('color', c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </label>
              {err && <div className="form-error">{err}</div>}
              <div className="form-actions">
                {editing && (
                  <button type="button" className="btn-ghost" onClick={handleCancel}>Cancel</button>
                )}
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Add location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

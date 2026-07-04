import { useState, useEffect } from 'react'

const COLORS = ['#f0a020', '#f85149', '#3fb950', '#58a6ff', '#e040fb', '#ff6b6b', '#26c6da']

export default function FavoriteNamePrompt({ coord, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setName('')
    setColor(COLORS[0])
    setErr(null)
  }, [coord])

  if (!coord) return null

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Give your favorite a name.')
      return
    }
    setSaving(true)
    const ok = await onSave({
      name: name.trim(),
      latitude: coord.lat,
      longitude: coord.lng,
      color,
      is_favorite: true,
    })
    setSaving(false)
    if (!ok) setErr('Could not save favorite. Try again.')
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal fav-prompt" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>
              <span className="fav-star-inline">★</span> Add favorite location
            </h2>
            <p className="modal-sub">
              {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
            </p>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="fav-prompt-form">
          <label className="form-label">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Home, Cabin, Trailhead…"
              className="form-input"
              maxLength={80}
              autoFocus
            />
          </label>
          <label className="form-label">
            Color
            <div className="kl-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`kl-color-btn ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </label>
          {err && <div className="form-error">{err}</div>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save favorite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

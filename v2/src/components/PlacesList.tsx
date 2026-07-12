import { useState, type FormEvent } from 'react'
import { firesWithinRadius, kmToMiles, milesToKm, type Fire, type SavedPlace, type UnitSystem } from '../domain'
import { geocodeAddress, shortLabel } from '../lib/geocode'
import { notificationsSupported, requestNotificationPermission } from '../hooks/usePlaceAlerts'

interface Props {
  locations: SavedPlace[]
  fires: Fire[]
  units: UnitSystem
  placing: boolean
  selectedId: string | null
  onTogglePlacing: () => void
  onAdd: (lat: number, lng: number, name?: string) => void
  onUpdate: (id: string, patch: Partial<SavedPlace>) => void
  onRemove: (id: string) => void
  onFocus: (place: SavedPlace) => void
}

export function PlacesList({ locations, fires, units, placing, selectedId, onTogglePlacing, onAdd, onUpdate, onRemove, onFocus }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permNote, setPermNote] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const query = address.trim()
    if (!query || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await geocodeAddress(query)
      if (!result) { setError('Address not found.'); return }
      onAdd(result.lat, result.lng, name.trim() || shortLabel(result.label))
      setName('')
      setAddress('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleAlert = async (place: SavedPlace) => {
    if (place.alertEnabled) {
      onUpdate(place.id, { alertEnabled: false })
      return
    }
    const granted = await requestNotificationPermission()
    onUpdate(place.id, { alertEnabled: granted })
    setPermNote(granted ? null : 'Allow browser notifications to receive alerts.')
  }

  const setRadius = (place: SavedPlace, displayValue: number) => {
    if (!Number.isFinite(displayValue) || displayValue <= 0) return
    onUpdate(place.id, { alertRadiusKm: units === 'metric' ? displayValue : milesToKm(displayValue) })
  }

  const unitLabel = units === 'metric' ? 'km' : 'mi'

  return (
    <div className="list-inner">
      <div className="list-head">
        <form onSubmit={submit} className="place-form">
          <input className="search" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Place name" />
          <div className="place-form-row">
            <input className="search" placeholder="Address or place…" value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Address" />
            <button className="btn-primary place-go" type="submit" disabled={busy || !address.trim()}>{busy ? '…' : 'Add'}</button>
          </div>
        </form>
        {error && <div className="place-error">{error}</div>}
        <button className={`place-add ${placing ? 'active' : ''}`} onClick={onTogglePlacing} type="button">
          {placing ? 'Click the map to drop a place…' : 'Or drop a pin on the map'}
        </button>
        {permNote && <div className="place-error">{permNote}</div>}
      </div>

      <div className="list-scroll">
        {locations.length === 0 && <p className="list-empty">No saved places yet.</p>}
        {locations.map((place) => {
          const inRange = firesWithinRadius(fires, place).length
          const radiusDisplay = units === 'metric' ? Math.round(place.alertRadiusKm) : Math.round(kmToMiles(place.alertRadiusKm))
          return (
            <div key={place.id} className={`place-card ${place.id === selectedId ? 'selected' : ''}`}>
              <div className="place-card-head">
                <input
                  type="color" className="place-color" value={place.color}
                  onChange={(e) => onUpdate(place.id, { color: e.target.value })}
                  title="Marker color" aria-label="Marker color"
                />
                <input className="place-name-input" value={place.name} onChange={(e) => onUpdate(place.id, { name: e.target.value })} aria-label="Place name" />
                <button className="icon-btn small" onClick={() => onRemove(place.id)} type="button" aria-label={`Remove ${place.name}`}>✕</button>
              </div>
              <div className="place-coords">{place.lat.toFixed(3)}, {place.lng.toFixed(3)}</div>

              <div className="place-alert-row">
                <button
                  className={`switch small ${place.alertEnabled ? 'on' : ''}`}
                  onClick={() => toggleAlert(place)}
                  type="button"
                  role="switch"
                  aria-checked={place.alertEnabled}
                  disabled={!notificationsSupported()}
                >
                  <span className="switch-knob" />
                  <span className="switch-label">Alert</span>
                </button>
                <label className="radius-input">
                  within
                  <input
                    type="number" min={1} max={500} value={radiusDisplay}
                    onChange={(e) => setRadius(place, Number(e.target.value))}
                    aria-label="Alert radius"
                  />
                  {unitLabel}
                </label>
                {place.alertEnabled && (
                  <span className={`in-range ${inRange > 0 ? 'hot' : ''}`}>{inRange} in range</span>
                )}
              </div>

              <button className="place-focus" type="button" onClick={() => onFocus(place)}>
                {place.id === selectedId ? 'Showing' : 'Show'} fires within {radiusDisplay}{unitLabel} →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

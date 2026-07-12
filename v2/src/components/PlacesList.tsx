import { useState, type FormEvent } from 'react'
import type { KeyLocation } from '../hooks/useKeyLocations'
import { geocodeAddress, shortLabel } from '../lib/geocode'

interface Props {
  locations: KeyLocation[]
  placing: boolean
  onTogglePlacing: () => void
  onRemove: (id: string) => void
  onAdd: (lat: number, lng: number, name?: string) => void
}

export function PlacesList({ locations, placing, onTogglePlacing, onRemove, onAdd }: Props) {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const query = address.trim()
    if (!query || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await geocodeAddress(query)
      if (!result) {
        setError('Address not found.')
        return
      }
      onAdd(result.lat, result.lng, shortLabel(result.label))
      setAddress('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="list-inner">
      <div className="list-head">
        <form onSubmit={submit} className="place-form">
          <input
            className="search"
            placeholder="Add by address or place…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address"
          />
          <button className="btn-primary place-go" type="submit" disabled={busy || !address.trim()}>
            {busy ? '…' : 'Add'}
          </button>
        </form>
        {error && <div className="place-error">{error}</div>}
        <button className={`place-add ${placing ? 'active' : ''}`} onClick={onTogglePlacing} type="button">
          {placing ? 'Click the map to drop a place…' : 'Or drop a pin on the map'}
        </button>
      </div>
      <div className="list-scroll">
        {locations.length === 0 && <p className="list-empty">No saved places yet.</p>}
        {locations.map((l) => (
          <div key={l.id} className="place-row">
            <span className="place-main">
              <span className="place-name">{l.name}</span>
              <span className="place-coords">{l.lat.toFixed(3)}, {l.lng.toFixed(3)}</span>
            </span>
            <button className="icon-btn small" onClick={() => onRemove(l.id)} type="button" aria-label={`Remove ${l.name}`}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

import type { KeyLocation } from '../hooks/useKeyLocations'

interface Props {
  locations: KeyLocation[]
  placing: boolean
  onTogglePlacing: () => void
  onRemove: (id: string) => void
}

export function PlacesList({ locations, placing, onTogglePlacing, onRemove }: Props) {
  return (
    <div className="list-inner">
      <div className="list-head">
        <button className={`place-add ${placing ? 'active' : ''}`} onClick={onTogglePlacing} type="button">
          {placing ? 'Click the map to drop a place…' : '+ Add place'}
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

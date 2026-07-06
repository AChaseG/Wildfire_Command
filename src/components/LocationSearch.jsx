import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { escapeHtml } from '../lib/escapeHtml'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

function parseCoordinates(query) {
  const m = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export default function LocationSearch() {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const markerRef = useRef(null)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (markerRef.current) map.removeLayer(markerRef.current)
    }
  }, [map])

  const dropMarker = (lat, lng, label) => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current)
    }
    const icon = L.divIcon({
      className: 'search-marker',
      html: '<div class="search-marker-pin"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
    const m = L.marker([lat, lng], { icon }).addTo(map)
    if (label) m.bindPopup(escapeHtml(label))
    markerRef.current = m
  }

  const flyTo = (lat, lng, zoom) => {
    map.flyTo([lat, lng], zoom ?? 12, { duration: 0.8 })
  }

  const handleSearch = (value) => {
    setQuery(value)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (!trimmed) {
      setResults([])
      setOpen(false)
      return
    }

    // Coordinate shortcut: immediate, no debounce
    const coords = parseCoordinates(trimmed)
    if (coords) {
      setResults([])
      setOpen(false)
      dropMarker(coords.lat, coords.lng, `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
      flyTo(coords.lat, coords.lng, 12)
      return
    }

    // Address search: debounce 350ms
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setOpen(true)
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const url = `${NOMINATIM_URL}?format=json&limit=5&q=${encodeURIComponent(trimmed)}&countrycodes=us`
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'en' },
        })
        if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
        const data = await res.json()
        setResults(
          (data || []).map((r) => ({
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            label: r.display_name,
          })),
        )
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  const handlePick = (r) => {
    dropMarker(r.lat, r.lng, r.label)
    flyTo(r.lat, r.lng, 12)
    setQuery(r.label.split(',').slice(0, 2).join(','))
    setOpen(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (results.length > 0) {
      handlePick(results[0])
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    setError(null)
    if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }
  }

  return (
    <div className="location-search">
      <form onSubmit={handleSubmit} className="search-form">
        <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search address or 'lat, lng'"
          aria-label="Search location"
        />
        {query && (
          <button type="button" className="search-clear" onClick={clearSearch} aria-label="Clear search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </form>

      {open && (loading || error || results.length > 0) && (
        <div className="search-results">
          {loading && <div className="search-status">Searching…</div>}
          {error && <div className="search-status error">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="search-status">No matches found.</div>
          )}
          {results.map((r, i) => (
            <button key={i} className="search-result" onClick={() => handlePick(r)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="result-label">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

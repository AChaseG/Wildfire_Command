import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SEVERITY_META, type Fire } from '../domain'

const SOURCE_ID = 'fires'
const US_CENTER: [number, number] = [-108, 41]

type GeoData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

// Default to a self-contained dark style so the map always renders offline; set
// VITE_MAP_STYLE to a keyless vector style (e.g. OpenFreeMap/MapTiler) in
// production for a full basemap.
const INLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1117' } }],
}
const STYLE: maplibregl.StyleSpecification | string = import.meta.env.VITE_MAP_STYLE ?? INLINE_STYLE

function toGeoJSON(fires: Fire[]): GeoData {
  return {
    type: 'FeatureCollection',
    features: fires.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: { type: 'Point', coordinates: [f.location.lng, f.location.lat] },
      properties: { id: f.id, name: f.name, color: SEVERITY_META[f.severity].color, severity: f.severity },
    })),
  } as unknown as GeoData
}

// A light lng/lat grid so the map reads as a map even with the inline style.
function graticule(): GeoData {
  const features = []
  for (let lng = -130; lng <= -60; lng += 10) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng, 15], [lng, 60]] } })
  }
  for (let lat = 20; lat <= 55; lat += 5) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-130, lat], [-60, lat]] } })
  }
  return { type: 'FeatureCollection', features } as unknown as GeoData
}

// Radius grows with severity; expressions keep styling on the GPU.
const RADIUS: maplibregl.ExpressionSpecification = ['match', ['get', 'severity'], 'extreme', 11, 'high', 8, 'moderate', 6, 4]

interface Props {
  fires: Fire[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function FireMap({ fires, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const firesRef = useRef(fires)
  firesRef.current = fires
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Initialize the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: US_CENTER,
      zoom: 3.7,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('graticule', { type: 'geojson', data: graticule() })
      map.addLayer({ id: 'graticule', type: 'line', source: 'graticule', paint: { 'line-color': '#1b2431', 'line-width': 1 } })

      map.addSource(SOURCE_ID, { type: 'geojson', data: toGeoJSON(firesRef.current), promoteId: 'id' })
      map.addLayer({
        id: 'fire-glow', type: 'circle', source: SOURCE_ID,
        paint: { 'circle-radius': ['*', RADIUS, 2.4], 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.35 },
      })
      map.addLayer({
        id: 'fire-point', type: 'circle', source: SOURCE_ID,
        paint: {
          'circle-radius': RADIUS,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1],
        },
      })

      map.on('click', 'fire-point', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') onSelectRef.current(id)
      })
      map.on('mouseenter', 'fire-point', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'fire-point', () => { map.getCanvas().style.cursor = '' })

      loadedRef.current = true
      syncSelection(map, firesRef.current, selectedIdRef.current)
    })

    return () => {
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [])

  // Push fire updates into the map source when the data changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(fires))
  }, [fires])

  // Reflect the selected incident: highlight it and ease toward it.
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSelection(map, firesRef.current, selectedId)
  }, [selectedId])

  return <div className="map" ref={containerRef} />
}

function syncSelection(map: maplibregl.Map, fires: Fire[], selectedId: string | null) {
  for (const f of fires) {
    map.setFeatureState({ source: SOURCE_ID, id: f.id }, { selected: f.id === selectedId })
  }
  const selected = fires.find((f) => f.id === selectedId)
  if (selected) {
    map.easeTo({ center: [selected.location.lng, selected.location.lat], zoom: Math.max(map.getZoom(), 6), duration: 700 })
  }
}

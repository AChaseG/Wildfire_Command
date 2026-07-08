import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SEVERITY_META, type Fire, type Hotspot } from '../domain'

const SOURCE_ID = 'fires'
const HOTSPOT_ID = 'hotspots'
const US_CENTER: [number, number] = [-108, 41]

type GeoData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

const INLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1117' } }],
}
const STYLE: maplibregl.StyleSpecification | string = import.meta.env.VITE_MAP_STYLE ?? INLINE_STYLE

function firesToGeoJSON(fires: Fire[]): GeoData {
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

function hotspotsToGeoJSON(hotspots: Hotspot[]): GeoData {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((h) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: { weight: h.frp ?? 1 },
    })),
  } as unknown as GeoData
}

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

const RADIUS: maplibregl.ExpressionSpecification = ['match', ['get', 'severity'], 'extreme', 11, 'high', 8, 'moderate', 6, 4]

interface Props {
  fires: Fire[]
  hotspots: Hotspot[]
  showHotspots: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function FireMap({ fires, hotspots, showHotspots, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const firesRef = useRef(fires)
  firesRef.current = fires
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots
  const showHotspotsRef = useRef(showHotspots)
  showHotspotsRef.current = showHotspots
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

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

      map.addSource(HOTSPOT_ID, { type: 'geojson', data: hotspotsToGeoJSON(hotspotsRef.current) })
      map.addLayer({
        id: 'hotspot-heat', type: 'heatmap', source: HOTSPOT_ID,
        layout: { visibility: showHotspotsRef.current ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 40, 1],
          'heatmap-intensity': 0.8,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 28],
          'heatmap-opacity': 0.75,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.3, '#7e1a12',
            0.6, '#f0a020',
            1, '#ffe08a',
          ],
        },
      })
      // A translucent point layer accompanies the heatmap: individual detections
      // stay visible when zoomed in (and it renders where software WebGL skips
      // the heatmap pass).
      map.addLayer({
        id: 'hotspot-point', type: 'circle', source: HOTSPOT_ID,
        layout: { visibility: showHotspotsRef.current ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 5],
          'circle-color': '#ff8c1a',
          'circle-opacity': 0.65,
          'circle-blur': 0.3,
        },
      })

      map.addSource(SOURCE_ID, { type: 'geojson', data: firesToGeoJSON(firesRef.current), promoteId: 'id' })
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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(firesToGeoJSON(fires))
  }, [fires])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(HOTSPOT_ID) as maplibregl.GeoJSONSource | undefined)?.setData(hotspotsToGeoJSON(hotspots))
  }, [hotspots])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const visibility = showHotspots ? 'visible' : 'none'
    for (const id of ['hotspot-heat', 'hotspot-point']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
    }
  }, [showHotspots])

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

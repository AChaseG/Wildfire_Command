import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SEVERITY_META, haversineKm, formatDistance, type Fire, type Hotspot, type UnitSystem } from '../domain'
import type { SavedPlace } from '../domain'
import { basemapStyle } from '../lib/basemaps'

export type MapMode = 'select' | 'measure' | 'place'

const SOURCE_ID = 'fires'
const HOTSPOT_ID = 'hotspots'
const MEASURE_ID = 'measure'

// A 5-point star, colored per place. Rendered as an HTML marker (not a style
// layer) so it survives basemap switches and can be any color.
function starMarkerElement(color: string, title: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'place-marker'
  el.title = title
  el.innerHTML =
    `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">` +
    `<path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" ` +
    `fill="${color}" stroke="#0b0e14" stroke-width="1.2" stroke-linejoin="round"/></svg>`
  return el
}
const US_CENTER: [number, number] = [-108, 41]

type GeoData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

// Basemap comes from the picker (lib/basemaps). If the chosen style can't load
// in time, we fall back to the inline style below so the map always renders.
const INLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1117' } }],
}
const STYLE_FALLBACK_MS = 6000

function firesToGeoJSON(fires: Fire[]): GeoData {
  return {
    type: 'FeatureCollection',
    features: fires.map((f) => ({
      type: 'Feature', id: f.id,
      geometry: { type: 'Point', coordinates: [f.location.lng, f.location.lat] },
      properties: { id: f.id, name: f.name, color: SEVERITY_META[f.severity].color, severity: f.severity },
    })),
  } as unknown as GeoData
}

function pointsToGeoJSON(points: [number, number][]): GeoData {
  return { type: 'FeatureCollection', features: points.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) } as unknown as GeoData
}

function measureToGeoJSON(points: [number, number][]): GeoData {
  const features: unknown[] = points.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
  if (points.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } })
  return { type: 'FeatureCollection', features } as unknown as GeoData
}

const RADIUS: maplibregl.ExpressionSpecification = ['match', ['get', 'severity'], 'extreme', 11, 'high', 8, 'moderate', 6, 4]

function totalKm(points: [number, number][]): number {
  let km = 0
  for (let i = 1; i < points.length; i++) {
    km += haversineKm({ lat: points[i - 1]![1], lng: points[i - 1]![0] }, { lat: points[i]![1], lng: points[i]![0] })
  }
  return km
}

interface Props {
  fires: Fire[]
  hotspots: Hotspot[]
  showHotspots: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  mode: MapMode
  units: UnitSystem
  keyLocations: SavedPlace[]
  onPlaceLocation: (lat: number, lng: number) => void
  basemapId: string
}

export function FireMap({ fires, hotspots, showHotspots, selectedId, onSelect, mode, units, keyLocations, onPlaceLocation, basemapId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const placeMarkersRef = useRef<maplibregl.Marker[]>([])
  const loadedRef = useRef(false)
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([])
  const measurePointsRef = useRef(measurePoints); measurePointsRef.current = measurePoints

  const basemapIdRef = useRef(basemapId); basemapIdRef.current = basemapId
  const firesRef = useRef(fires); firesRef.current = fires
  const hotspotsRef = useRef(hotspots); hotspotsRef.current = hotspots
  const showHotspotsRef = useRef(showHotspots); showHotspotsRef.current = showHotspots
  const selectedIdRef = useRef(selectedId); selectedIdRef.current = selectedId
  const modeRef = useRef(mode); modeRef.current = mode
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const onPlaceRef = useRef(onPlaceLocation); onPlaceRef.current = onPlaceLocation

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current, style: basemapStyle(basemapIdRef.current), center: US_CENTER, zoom: 3.7, attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Adds our data sources + layers. Idempotent, and re-run after a style
    // fallback (setStyle clears sources), so it wires up regardless of which
    // basemap actually loaded.
    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(HOTSPOT_ID, { type: 'geojson', data: pointsToGeoJSON(hotspotsRef.current.map((h) => [h.lng, h.lat])) })
      map.addLayer({
        id: 'hotspot-heat', type: 'heatmap', source: HOTSPOT_ID,
        layout: { visibility: showHotspotsRef.current ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 40, 1],
          'heatmap-intensity': 0.8,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 28],
          'heatmap-opacity': 0.75,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, '#7e1a12', 0.6, '#f0a020', 1, '#ffe08a'],
        },
      })
      map.addLayer({
        id: 'hotspot-point', type: 'circle', source: HOTSPOT_ID,
        layout: { visibility: showHotspotsRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 5], 'circle-color': '#ff8c1a', 'circle-opacity': 0.65, 'circle-blur': 0.3 },
      })

      map.addSource(SOURCE_ID, { type: 'geojson', data: firesToGeoJSON(firesRef.current), promoteId: 'id' })
      map.addLayer({ id: 'fire-glow', type: 'circle', source: SOURCE_ID, paint: { 'circle-radius': ['*', RADIUS, 2.4], 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.35 } })
      map.addLayer({
        id: 'fire-point', type: 'circle', source: SOURCE_ID,
        paint: { 'circle-radius': RADIUS, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1] },
      })

      map.addSource(MEASURE_ID, { type: 'geojson', data: measureToGeoJSON(measurePointsRef.current) })
      map.addLayer({ id: 'measure-line', type: 'line', source: MEASURE_ID, filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#7aa2ff', 'line-width': 2, 'line-dasharray': [2, 1.5] } })
      map.addLayer({ id: 'measure-point', type: 'circle', source: MEASURE_ID, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 4, 'circle-color': '#7aa2ff', 'circle-stroke-color': '#0b0e14', 'circle-stroke-width': 1.5 } })

      loadedRef.current = true
      syncSelection(map, firesRef.current, selectedIdRef.current)
    }

    // Bind interactions once (they live on the map, not the style).
    map.on('click', 'fire-point', (e) => {
      if (modeRef.current !== 'select') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelectRef.current(id)
    })
    map.on('mouseenter', 'fire-point', () => { if (modeRef.current === 'select') map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'fire-point', () => { if (modeRef.current === 'select') map.getCanvas().style.cursor = '' })
    map.on('click', (e) => {
      const m = modeRef.current
      if (m === 'place') { onPlaceRef.current(e.lngLat.lat, e.lngLat.lng); return }
      if (m === 'measure') setMeasurePoints((pts) => [...pts, [e.lngLat.lng, e.lngLat.lat]])
    })

    // If the remote basemap doesn't load in time, fall back to the inline style.
    let fellBack = false
    const fallbackTimer = setTimeout(() => {
      if (!fellBack && !map.isStyleLoaded()) { fellBack = true; map.setStyle(INLINE_STYLE) }
    }, STYLE_FALLBACK_MS)

    map.on('style.load', () => { clearTimeout(fallbackTimer); addLayers() })

    return () => { clearTimeout(fallbackTimer); map.remove(); mapRef.current = null; loadedRef.current = false }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(firesToGeoJSON(fires))
  }, [fires])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(HOTSPOT_ID) as maplibregl.GeoJSONSource | undefined)?.setData(pointsToGeoJSON(hotspots.map((h) => [h.lng, h.lat])))
  }, [hotspots])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const visibility = showHotspots ? 'visible' : 'none'
    for (const id of ['hotspot-heat', 'hotspot-point']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
  }, [showHotspots])

  // Star markers are HTML overlays (independent of the style), so recreate them
  // whenever the places change; they persist across basemap switches on their own.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const marker of placeMarkersRef.current) marker.remove()
    placeMarkersRef.current = keyLocations.map((place) =>
      new maplibregl.Marker({ element: starMarkerElement(place.color, place.name) })
        .setLngLat([place.lng, place.lat])
        .addTo(map),
    )
  }, [keyLocations])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(MEASURE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(measureToGeoJSON(measurePoints))
  }, [measurePoints])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mode !== 'measure' && measurePoints.length > 0) setMeasurePoints([])
    if (loadedRef.current) map.getCanvas().style.cursor = mode === 'select' ? '' : 'crosshair'
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSelection(map, firesRef.current, selectedId)
  }, [selectedId])

  // Switch basemaps when the picker changes. The map is already built with the
  // initial basemap, so skip the first run. setStyle clears our sources;
  // addLayers re-adds them on the resulting 'style.load'.
  const firstBasemapRun = useRef(true)
  useEffect(() => {
    if (firstBasemapRun.current) { firstBasemapRun.current = false; return }
    mapRef.current?.setStyle(basemapStyle(basemapId))
  }, [basemapId])

  return (
    <>
      <div className="map" ref={containerRef} />
      {mode === 'measure' && (
        <div className="measure-readout">
          {measurePoints.length < 2 ? 'Click points on the map to measure' : `${formatDistance(totalKm(measurePoints), units)} · ${measurePoints.length} points`}
        </div>
      )}
    </>
  )
}

function syncSelection(map: maplibregl.Map, fires: Fire[], selectedId: string | null) {
  for (const f of fires) map.setFeatureState({ source: SOURCE_ID, id: f.id }, { selected: f.id === selectedId })
  const selected = fires.find((f) => f.id === selectedId)
  if (selected) map.easeTo({ center: [selected.location.lng, selected.location.lat], zoom: Math.max(map.getZoom(), 6), duration: 700 })
}

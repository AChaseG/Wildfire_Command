import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Tooltip, useMap, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SEVERITY_META, aqiCategory, formatDateTime } from '../lib/fireUtils'
import { MAP_LAYERS, LABELS_OVERLAY_URL } from '../lib/mapLayers'
import { parseKml } from '../lib/kmlUtils'
import MeasureTool, { MEASURE_MODES } from './MeasureTool'
import LocationSearch from './LocationSearch'

function FlyToSelected({ selected, fires }) {
  const map = useMap()
  useEffect(() => {
    if (!selected) return
    const fire = fires.find((f) => f.id === selected)
    if (fire) {
      map.flyTo([fire.latitude, fire.longitude], 9, { duration: 0.8 })
    }
  }, [selected, fires, map])
  return null
}

function FitToFires({ fires }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || fires.length === 0) return
    const bounds = L.latLngBounds(fires.map((f) => [f.latitude, f.longitude]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 })
    done.current = true
  }, [fires, map])
  return null
}

function MeasuringCursor({ mode }) {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    if (mode !== MEASURE_MODES.none) {
      el.classList.add('measuring')
    } else {
      el.classList.remove('measuring')
    }
    return () => el.classList.remove('measuring')
  }, [mode, map])
  return null
}

function makeFireIcon(color, selected) {
  return L.divIcon({
    className: '',
    html: `<div class="fire-map-pin${selected ? ' selected' : ''}" style="--fire:${color}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="${color}" stroke="#fff" stroke-width="1.1" stroke-linejoin="round">
        <path d="M12 2c1.6 3.1 4.2 5.2 4.2 8.4a4.2 4.2 0 0 1-8.4 0c0-1.1.5-2.1 1.1-2.7-1.2.6-2.4 2.9-2.4 5.1a5.5 5.5 0 0 0 11 0c0-4.4-3.2-7.6-5.5-11.8z"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

function makeKeyLocIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="kl-map-pin" style="background:${color};box-shadow:0 0 0 3px ${color}44,0 2px 6px rgba(0,0,0,0.5)">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>
      </svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -28],
  })
}

function makeFavoriteIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="kl-map-star" style="color:${color}">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round">
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z"/>
      </svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

function FavoriteCursor({ active }) {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    if (active) el.classList.add('placing-favorite')
    else el.classList.remove('placing-favorite')
    return () => el.classList.remove('placing-favorite')
  }, [active, map])
  return null
}

function FavoritePlacer({ active, onPlace }) {
  useMapEvents({
    click(e) {
      if (active) onPlace({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function BoundsWatcher({ onBoundsChange }) {
  const map = useMap()
  useEffect(() => {
    if (!onBoundsChange) return
    const emit = () => onBoundsChange(map.getBounds())
    emit()
    map.on('moveend', emit)
    map.on('zoomend', emit)
    return () => {
      map.off('moveend', emit)
      map.off('zoomend', emit)
    }
  }, [map, onBoundsChange])
  return null
}

// Predictive risk field is sampled on an even grid across the viewport; each
// cell's normalized risk (0..1) drives heat intensity. Large radii blend the
// grid into a smooth surface at any zoom.
function cellWeight(risk) {
  return Math.max(0.12, Math.min(0.95, 0.15 + 0.82 * (risk ?? 0)))
}

function buildHeatGradient() {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0.15, '#2e6f3e')
  g.addColorStop(0.4, '#f0d000')
  g.addColorStop(0.6, '#f0a020')
  g.addColorStop(0.8, '#f85149')
  g.addColorStop(1.0, '#a01a1a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1, 256)
  const data = ctx.getImageData(0, 0, 1, 256).data
  const ramp = Array.from({ length: 256 })
  for (let i = 0; i < 256; i++) {
    ramp[i] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
  }
  return ramp
}

function RiskHeatLayer({ cells }) {
  const map = useMap()
  useEffect(() => {
    const canvas = L.DomUtil.create('canvas', 'risk-heat-canvas')
    canvas.style.pointerEvents = 'none'
    const pane = map.getPanes().overlayPane
    pane.appendChild(canvas)
    const ramp = buildHeatGradient()

    const draw = () => {
      const size = map.getSize()
      canvas.width = size.x
      canvas.height = size.y
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]))
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, size.x, size.y)
      // Radius covers roughly the grid spacing so blobs merge smoothly.
      const radius = Math.max(size.x, size.y) / 6

      for (const cell of cells) {
        if (cell.latitude == null || cell.longitude == null) continue
        const p = map.latLngToContainerPoint([cell.latitude, cell.longitude])
        if (p.x < -radius || p.y < -radius || p.x > size.x + radius || p.y > size.y + radius) continue
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius)
        grd.addColorStop(0, `rgba(0,0,0,${cellWeight(cell.risk)})`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      const img = ctx.getImageData(0, 0, size.x, size.y)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]
        if (a === 0) continue
        const color = ramp[Math.min(255, a)]
        d[i] = color[0]
        d[i + 1] = color[1]
        d[i + 2] = color[2]
        d[i + 3] = Math.min(190, a + 35)
      }
      ctx.putImageData(img, 0, 0)
    }

    draw()
    map.on('moveend zoomend resize', draw)
    return () => {
      map.off('moveend zoomend resize', draw)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }, [map, cells])
  return null
}

const KML_PALETTE = ['#58a6ff', '#3fb950', '#f0a020', '#f85149', '#26c6da', '#ec4899']

function KmlOverlay({ sources }) {
  const map = useMap()
  // Signature so the layer only rebuilds when the visible KML set actually changes.
  const signature = useMemo(
    () => sources.map((s) => `${s.id}:${(s.kml_content || '').length}`).join('|'),
    [sources],
  )
  useEffect(() => {
    const group = L.layerGroup().addTo(map)
    sources.forEach((source, idx) => {
      const { features } = parseKml(source.kml_content)
      const color = KML_PALETTE[idx % KML_PALETTE.length]
      for (const feature of features) {
        for (const geom of feature.geometries) {
          let layer = null
          if (geom.type === 'polygon') {
            layer = L.polygon(geom.coords, { color, weight: 2, fillColor: color, fillOpacity: 0.15 })
          } else if (geom.type === 'line') {
            layer = L.polyline(geom.coords, { color, weight: 3, opacity: 0.85 })
          } else if (geom.type === 'point') {
            layer = L.circleMarker(geom.latlng, {
              radius: 5,
              color: '#fff',
              weight: 1.5,
              fillColor: color,
              fillOpacity: 1,
            })
          }
          if (layer) {
            layer.bindTooltip(
              `<div class="map-tooltip"><div class="map-tooltip-name">${feature.name}</div><div class="map-tooltip-row" style="opacity:0.7">${source.name}</div></div>`,
              { direction: 'top', opacity: 1 },
            )
            layer.addTo(group)
          }
        }
      }
    })
    return () => {
      group.remove()
    }
  }, [map, signature]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function FireMap({
  fires,
  selectedId,
  onSelect,
  layerId,
  measureMode,
  onClearMeasure,
  keyLocations = [],
  placingFavorite = false,
  onPlaceFavorite,
  onBoundsChange,
  showHeatmap = false,
  riskCells = [],
  kmlSources = [],
}) {
  const layer = useMemo(
    () => MAP_LAYERS.find((l) => l.id === layerId) || MAP_LAYERS[0],
    [layerId],
  )

  const center = useMemo(() => {
    if (fires.length === 0) return [20, 0]
    const lat = fires.reduce((s, f) => s + f.latitude, 0) / fires.length
    const lng = fires.reduce((s, f) => s + f.longitude, 0) / fires.length
    return [lat, lng]
  }, [fires])

  return (
    <MapContainer
      center={center}
      zoom={2}
      scrollWheelZoom
      className="fire-map"
      zoomControl={false}
      worldCopyJump
      minZoom={2}
    >
      <TileLayer
        key={layer.id}
        url={layer.url}
        attribution={layer.attribution}
        maxZoom={layer.maxZoom}
      />
      {layer.labels && (
        <TileLayer
          url={LABELS_OVERLAY_URL}
          attribution=""
          maxZoom={15}
        />
      )}
      <FlyToSelected selected={selectedId} fires={fires} />
      <FitToFires fires={fires} />
      <MeasuringCursor mode={measureMode} />
      <FavoriteCursor active={placingFavorite} />
      <FavoritePlacer active={placingFavorite} onPlace={onPlaceFavorite} />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      {showHeatmap && <RiskHeatLayer cells={riskCells} />}
      {kmlSources.length > 0 && <KmlOverlay sources={kmlSources} />}
      <LocationSearch />

      {fires.map((fire) => {
        const meta = SEVERITY_META[fire.severity] || SEVERITY_META.moderate
        const aqi = aqiCategory(fire.air_quality)
        const isSelected = fire.id === selectedId
        return (
          <Marker
            key={fire.id}
            position={[fire.latitude, fire.longitude]}
            icon={makeFireIcon(meta.color, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelect(fire.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={1}>
              <div className="map-tooltip">
                <div className="map-tooltip-name">{fire.name}</div>
                <div className="map-tooltip-row">
                  <span className="dot" style={{ background: meta.color }} />
                  {meta.label} &middot; {fire.status}
                </div>
                <div className="map-tooltip-row">
                  <span className="dot" style={{ background: aqi.color }} />
                  AQI {fire.air_quality ?? '—'} &middot; {fire.acreage_burned?.toLocaleString()} ac
                </div>
                <div className="map-tooltip-time">
                  Started {formatDateTime(fire.started_at)}
                  {fire.ended_at && ` · Ended ${formatDateTime(fire.ended_at)}`}
                </div>
              </div>
            </Tooltip>
          </Marker>
        )
      })}

      {keyLocations.filter((loc) => loc.visible !== false).map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={loc.is_favorite ? makeFavoriteIcon(loc.color || '#f0a020') : makeKeyLocIcon(loc.color || '#f0a020')}
        >
          <Tooltip direction="top" offset={[0, loc.is_favorite ? -14 : -28]} opacity={1}>
            <div className="map-tooltip">
              <div className="map-tooltip-name">
                {loc.is_favorite ? '★ ' : ''}{loc.name}
              </div>
              {loc.description && <div className="map-tooltip-row">{loc.description}</div>}
              <div className="map-tooltip-row" style={{ opacity: 0.7 }}>
                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}

      <MeasureTool mode={measureMode} onClear={onClearMeasure} />
    </MapContainer>
  )
}

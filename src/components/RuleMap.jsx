import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Circle,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_LAYERS } from '../lib/mapLayers'
import { haversine } from '../lib/geoUtils'
import { useUnits } from '../context/UnitsContext'
import { metersToLength } from '../lib/units'

const DEFAULT_CENTER = [47.35, -120.4]

function DrawEvents({ mode, onAddPoint, onUndo }) {
  useMapEvents({
    click(e) {
      if (mode !== 'none') {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
    contextmenu(e) {
      if (mode === 'polygon') {
        e.originalEvent.preventDefault()
        e.originalEvent.stopPropagation()
        onUndo()
      }
    },
  })
  return null
}

function RadiusEvents({ mode, onSetCenter, onSetRadius }) {
  const [center, setCenter] = useState(null)
  useMapEvents({
    click(e) {
      if (mode === 'radius') {
        const pt = { lat: e.latlng.lat, lng: e.latlng.lng }
        setCenter(pt)
        onSetCenter(pt)
      }
    },
    mousemove(e) {
      if (mode === 'radius' && center) {
        const r = haversine(center, { lat: e.latlng.lat, lng: e.latlng.lng })
        onSetRadius(r)
      }
    },
  })
  return null
}

export default function RuleMap({ geoType, polygon, center, radiusM, onChange }) {
  const { units } = useUnits()
  const [mode, setMode] = useState(geoType || 'none')
  const [polyPoints, setPolyPoints] = useState(polygon || [])
  const [radCenter, setRadCenter] = useState(
    center ? { lat: center.lat, lng: center.lng } : null,
  )
  const [radRadius, setRadRadius] = useState(radiusM || 0)

  useEffect(() => {
    setMode(geoType || 'none')
    setPolyPoints(polygon || [])
    setRadCenter(center ? { lat: center.lat, lng: center.lng } : null)
    setRadRadius(radiusM || 0)
  }, [geoType, polygon, center, radiusM])

  const commit = (updates) => {
    onChange(updates)
  }

  const handleSetMode = (newMode) => {
    setMode(newMode)
    if (newMode === 'none') {
      setPolyPoints([])
      setRadCenter(null)
      setRadRadius(0)
      commit({ geo_type: null, geo_polygon: null, geo_center_lat: null, geo_center_lng: null, geo_radius_m: null })
    } else if (newMode === 'polygon') {
      commit({ geo_type: 'polygon', geo_center_lat: null, geo_center_lng: null, geo_radius_m: null })
    } else if (newMode === 'radius') {
      commit({ geo_type: 'radius', geo_polygon: null })
    }
  }

  const handleAddPoint = (pt) => {
    if (mode !== 'polygon') return
    const next = [...polyPoints, pt]
    setPolyPoints(next)
    commit({ geo_type: 'polygon', geo_polygon: next })
  }

  const handleUndo = () => {
    if (mode !== 'polygon') return
    const next = polyPoints.slice(0, -1)
    setPolyPoints(next)
    commit({ geo_type: 'polygon', geo_polygon: next })
  }

  const handleClearPoly = () => {
    setPolyPoints([])
    commit({ geo_type: 'polygon', geo_polygon: [] })
  }

  const handleSetCenter = (pt) => {
    setRadCenter(pt)
    commit({ geo_type: 'radius', geo_center_lat: pt.lat, geo_center_lng: pt.lng })
  }

  const handleSetRadius = (r) => {
    setRadRadius(r)
    if (radCenter) {
      commit({ geo_type: 'radius', geo_center_lat: radCenter.lat, geo_center_lng: radCenter.lng, geo_radius_m: r })
    }
  }

  const handleClearRadius = () => {
    setRadCenter(null)
    setRadRadius(0)
    commit({ geo_type: 'radius', geo_center_lat: null, geo_center_lng: null, geo_radius_m: null })
  }

  const layer = MAP_LAYERS.find((l) => l.id === 'dark') || MAP_LAYERS[0]
  const polyPositions = polyPoints.map((p) => [p.lat, p.lng])
  const radCenterArr = radCenter ? [radCenter.lat, radCenter.lng] : null

  return (
    <div className="rule-map-wrap">
      <div className="rule-map-toolbar">
        <button
          className={`rule-map-btn ${mode === 'polygon' ? 'active' : ''}`}
          onClick={() => handleSetMode('polygon')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3 3 8l2 8 7 5 7-5 2-8z" />
          </svg>
          Draw polygon
        </button>
        <button
          className={`rule-map-btn ${mode === 'radius' ? 'active' : ''}`}
          onClick={() => handleSetMode('radius')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
          Set radius
        </button>
        {mode !== 'none' && (
          <button className="rule-map-btn danger" onClick={() => handleSetMode('none')}>
            Clear area
          </button>
        )}
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={6}
        scrollWheelZoom
        className="rule-map"
        zoomControl={false}
      >
        <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
        <DrawEvents
          mode={mode}
          onAddPoint={handleAddPoint}
          onUndo={handleUndo}
        />
        <RadiusEvents
          mode={mode}
          onSetCenter={handleSetCenter}
          onSetRadius={handleSetRadius}
        />

        {mode === 'polygon' && polyPositions.length >= 2 && (
          <Polyline
            positions={polyPositions}
            pathOptions={{ color: '#f85149', weight: 2, dashArray: '5 5' }}
          />
        )}
        {mode === 'polygon' && polyPositions.length >= 3 && (
          <Polygon
            positions={polyPositions}
            pathOptions={{ color: '#f85149', weight: 2, fillColor: '#f85149', fillOpacity: 0.15 }}
          />
        )}
        {mode === 'polygon' &&
          polyPoints.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={4}
              pathOptions={{ color: '#f85149', fillColor: '#f85149', fillOpacity: 1 }}
            />
          ))}

        {mode === 'radius' && radCenterArr && radRadius > 0 && (
          <Circle
            center={radCenterArr}
            radius={radRadius}
            pathOptions={{ color: '#f0a020', weight: 2, fillColor: '#f0a020', fillOpacity: 0.15, dashArray: '4 6' }}
          >
            <Tooltip sticky>
              <div className="measure-tooltip">
                <div className="measure-label">Radius</div>
                <div className="measure-value">{metersToLength(radRadius, units)}</div>
              </div>
            </Tooltip>
          </Circle>
        )}
        {mode === 'radius' && radCenterArr && (
          <CircleMarker
            center={radCenterArr}
            radius={4}
            pathOptions={{ color: '#f0a020', fillColor: '#f0a020', fillOpacity: 1 }}
          />
        )}
      </MapContainer>

      <div className="rule-map-hint">
        {mode === 'polygon' && (
          <>
            Click to add polygon vertices. Right-click to undo the last point.
            {polyPoints.length > 0 && (
              <button className="rule-map-link" onClick={handleClearPoly}>Clear polygon</button>
            )}
            <span className="rule-map-count">{polyPoints.length} points</span>
          </>
        )}
        {mode === 'radius' && (
          <>
            Click to set the center, then move the mouse to size the radius.
            {radCenter && (
              <button className="rule-map-link" onClick={handleClearRadius}>Clear radius</button>
            )}
            {radRadius > 0 && (
              <span className="rule-map-count">{metersToLength(radRadius, units)}</span>
            )}
          </>
        )}
        {mode === 'none' && 'Choose a shape above to define a geographic filter for this rule.'}
      </div>
    </div>
  )
}

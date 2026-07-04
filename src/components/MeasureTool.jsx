import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { metersToLength, sqMetersToArea } from '../lib/units'
import { useUnits } from '../context/UnitsContext'

const MODES = {
  none: 'none',
  ruler: 'ruler',
  circle: 'circle',
}

function haversine(a, b) {
  const R = 6378137
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function totalDistance(points) {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1], points[i])
  }
  return d
}

function MapEvents({ mode, onAddPoint, onRemoveLast, onFinish }) {
  useMapEvents({
    click(e) {
      if (mode === MODES.ruler) {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      } else if (mode === MODES.circle) {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
    dblclick(e) {
      if (mode === MODES.ruler) {
        e.originalEvent.stopPropagation()
        onFinish()
      }
    },
    contextmenu(e) {
      if (mode === MODES.ruler) {
        e.originalEvent.preventDefault()
        e.originalEvent.stopPropagation()
        onRemoveLast()
      }
    },
  })
  return null
}

function MouseTracker({ mode, onHover }) {
  const map = useMap()
  useEffect(() => {
    if (mode === MODES.none) return
    const handler = (e) => {
      onHover({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    map.on('mousemove', handler)
    return () => {
      map.off('mousemove', handler)
    }
  }, [mode, map, onHover])
  return null
}

export default function MeasureTool({ mode, onClear }) {
  const { units } = useUnits()
  const [points, setPoints] = useState([])
  const [hover, setHover] = useState(null)
  const [circleRadius, setCircleRadius] = useState(null)
  const [finished, setFinished] = useState(false)
  const pendingClickRef = useRef(null)

  useEffect(() => {
    setPoints([])
    setHover(null)
    setCircleRadius(null)
    setFinished(false)
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current)
      pendingClickRef.current = null
    }
  }, [mode])

  const handleAddPoint = (pt) => {
    if (mode === MODES.ruler) {
      // Defer adding the point so a dblclick can cancel the last single click.
      // Leaflet fires click -> click -> dblclick. We wait 220ms; if a dblclick
      // arrives in that window, we cancel the pending add (the dblclick handler
      // calls onFinish). Otherwise we commit the point.
      if (pendingClickRef.current) {
        // Already a pending click; commit it before queueing the next.
        clearTimeout(pendingClickRef.current)
        pendingClickRef.current = null
        setPoints((prev) => [...prev, pt])
        // queue this one
        pendingClickRef.current = setTimeout(() => {
          pendingClickRef.current = null
          setPoints((prev) => [...prev, pt])
        }, 220)
        return
      }
      pendingClickRef.current = setTimeout(() => {
        pendingClickRef.current = null
        setPoints((prev) => [...prev, pt])
      }, 220)
    } else if (mode === MODES.circle) {
      setPoints([pt])
      setCircleRadius(0)
    }
  }

  const handleRemoveLast = () => {
    if (mode !== MODES.ruler) return
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current)
      pendingClickRef.current = null
    }
    setPoints((prev) => prev.slice(0, -1))
  }

  const handleFinish = () => {
    if (mode !== MODES.ruler) return
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current)
      pendingClickRef.current = null
    }
    setFinished(true)
  }

  useEffect(() => {
    if (mode !== MODES.circle || points.length === 0) return
    if (!hover) return
    const r = haversine(points[0], hover)
    setCircleRadius(r)
  }, [hover, points, mode])

  const rulerPoints = useMemo(() => {
    if (mode !== MODES.ruler) return []
    const pts = points.map((p) => [p.lat, p.lng])
    if (!finished && hover && points.length > 0) {
      pts.push([hover.lat, hover.lng])
    }
    return pts
  }, [points, hover, mode, finished])

  const distance = useMemo(() => {
    if (mode !== MODES.ruler) return 0
    let d = totalDistance(points)
    if (!finished && hover && points.length > 0) {
      d += haversine(points[points.length - 1], hover)
    }
    return d
  }, [points, hover, mode, finished])

  const circleArea = useMemo(() => {
    if (mode !== MODES.circle || circleRadius == null) return 0
    return Math.PI * circleRadius * circleRadius
  }, [circleRadius, mode])

  const circleCenter = points[0] ? [points[0].lat, points[0].lng] : null
  const hasMeasurement = points.length > 0 || circleRadius > 0

  return (
    <>
      <MapEvents
        mode={mode}
        onAddPoint={handleAddPoint}
        onRemoveLast={handleRemoveLast}
        onFinish={handleFinish}
      />
      <MouseTracker mode={mode} onHover={setHover} />

      {mode === MODES.ruler && rulerPoints.length >= 2 && (
        <Polyline
          positions={rulerPoints}
          pathOptions={{
            color: finished ? '#f85149' : '#f85149',
            weight: 3,
            dashArray: finished ? undefined : '6 6',
          }}
        >
          <Tooltip sticky>
            <div className="measure-tooltip">
              <div className="measure-label">Distance</div>
              <div className="measure-value">{metersToLength(distance, units)}</div>
              <div className="measure-hint">
                {finished
                  ? `${points.length} pts · finished`
                  : `${points.length} pts · dbl-click finish · right-click undo`}
              </div>
            </div>
          </Tooltip>
        </Polyline>
      )}

      {mode === MODES.ruler &&
        points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={4}
            pathOptions={{ color: '#f85149', fillColor: '#f85149', fillOpacity: 1 }}
          />
        ))}

      {mode === MODES.circle && circleCenter && circleRadius > 0 && (
        <Circle
          center={circleCenter}
          radius={circleRadius}
          pathOptions={{
            color: '#f0a020',
            weight: 2,
            fillColor: '#f0a020',
            fillOpacity: 0.15,
            dashArray: '4 6',
          }}
        >
          <Tooltip sticky>
            <div className="measure-tooltip">
              <div className="measure-label">Radius</div>
              <div className="measure-value">{metersToLength(circleRadius, units)}</div>
              <div className="measure-label">Area</div>
              <div className="measure-value">{sqMetersToArea(circleArea, units)}</div>
            </div>
          </Tooltip>
        </Circle>
      )}

      {mode === MODES.circle && circleCenter && (
        <CircleMarker
          center={circleCenter}
          radius={4}
          pathOptions={{ color: '#f0a020', fillColor: '#f0a020', fillOpacity: 1 }}
        />
      )}

      {hasMeasurement && (
        <div className="measure-readout">
          {mode === MODES.ruler && (
            <>
              <span className="readout-label">Distance</span>
              <span className="readout-value">{metersToLength(distance, units)}</span>
              <span className="readout-sub">
                {points.length} point{points.length === 1 ? '' : 's'}
                {finished ? ' · finished' : ''}
              </span>
            </>
          )}
          {mode === MODES.circle && circleRadius != null && (
            <>
              <span className="readout-label">Radius</span>
              <span className="readout-value">{metersToLength(circleRadius, units)}</span>
              <span className="readout-label">Area</span>
              <span className="readout-value">{sqMetersToArea(circleArea, units)}</span>
            </>
          )}
          <button className="readout-clear" onClick={onClear} aria-label="Clear measurement">
            Clear
          </button>
        </div>
      )}
    </>
  )
}

export { MODES as MEASURE_MODES }

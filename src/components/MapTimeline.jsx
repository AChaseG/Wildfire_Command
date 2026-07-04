import { useCallback, useMemo, useRef, useState } from 'react'
import { SEVERITY_META } from '../lib/fireUtils'

const DAY_MS = 86400000

function toDateInput(ms) {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromDateInput(str, endOfDay = false) {
  if (!str) return null
  return new Date(`${str}T${endOfDay ? '23:59:59' : '00:00:00'}`).getTime()
}

function shortDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export default function MapTimeline({ fires, dateFrom, dateTo, showHistorical, onToggleHistorical, onChange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null)

  const domain = useMemo(() => {
    const times = fires.map((f) => (f.started_at ? new Date(f.started_at).getTime() : null)).filter((t) => t != null)
    if (times.length === 0) return null
    const min = Math.min(...times)
    const max = Math.max(Math.max(...times), Date.now())
    return { min, max: max === min ? min + DAY_MS : max }
  }, [fires])

  const ticks = useMemo(() => {
    if (!domain) return []
    const span = domain.max - domain.min
    return fires
      .filter((f) => f.started_at)
      .map((f) => {
        const t = new Date(f.started_at).getTime()
        return {
          id: f.id,
          frac: clamp((t - domain.min) / span, 0, 1),
          color: (SEVERITY_META[f.severity] || SEVERITY_META.moderate).color,
          t,
        }
      })
  }, [fires, domain])

  const fromMs = fromDateInput(dateFrom)
  const toMs = fromDateInput(dateTo, true)

  const fromFrac = domain && fromMs != null ? clamp((fromMs - domain.min) / (domain.max - domain.min), 0, 1) : 0
  const toFrac = domain && toMs != null ? clamp((toMs - domain.min) / (domain.max - domain.min), 0, 1) : 1

  const hasRange = Boolean(dateFrom || dateTo)

  const todayStr = toDateInput(Date.now())
  const presets = [
    { label: 'Past week', days: 7 },
    { label: 'Past 2 weeks', days: 14 },
    { label: 'Past month', days: 30 },
  ]
  const applyPreset = (days) => {
    onChange({ from: toDateInput(Date.now() - days * DAY_MS), to: todayStr })
  }
  const activePreset = presets.find(
    (p) => dateTo === todayStr && dateFrom === toDateInput(Date.now() - p.days * DAY_MS),
  )

  const inRangeCount = useMemo(() => {
    return ticks.filter((tk) => {
      if (fromMs != null && tk.t < fromMs) return false
      if (toMs != null && tk.t > toMs) return false
      return true
    }).length
  }, [ticks, fromMs, toMs])

  const fracFromClientX = useCallback((clientX) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1)
  }, [])

  const applyFrac = useCallback(
    (which, frac) => {
      if (!domain) return
      const ms = domain.min + frac * (domain.max - domain.min)
      if (which === 'from') {
        onChange({ from: frac <= 0.004 ? '' : toDateInput(ms), to: dateTo })
      } else {
        onChange({ from: dateFrom, to: frac >= 0.996 ? '' : toDateInput(ms) })
      }
    },
    [domain, onChange, dateFrom, dateTo],
  )

  const beginDrag = useCallback(
    (which, e) => {
      e.preventDefault()
      setDragging(which)
      const move = (ev) => {
        const frac = fracFromClientX(ev.clientX)
        const bounded = which === 'from' ? Math.min(frac, toFrac) : Math.max(frac, fromFrac)
        applyFrac(which, bounded)
      }
      const up = () => {
        setDragging(null)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [applyFrac, fracFromClientX, fromFrac, toFrac],
  )

  const onTrackPointerDown = useCallback(
    (e) => {
      const frac = fracFromClientX(e.clientX)
      const which = Math.abs(frac - fromFrac) <= Math.abs(frac - toFrac) ? 'from' : 'to'
      beginDrag(which, e)
    },
    [beginDrag, fracFromClientX, fromFrac, toFrac],
  )

  if (!domain) return null

  return (
    <div className={`map-timeline ${dragging ? 'dragging' : ''}`}>
      <div className="timeline-head">
        <span className="timeline-title">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Historical Data
        </span>
        <div className="timeline-presets">
          {presets.map((p) => (
            <button
              key={p.days}
              className={`timeline-preset ${activePreset?.days === p.days ? 'active' : ''}`}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="timeline-dates">
          <label className="timeline-date">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || todayStr}
              onChange={(e) => onChange({ from: e.target.value, to: dateTo })}
            />
          </label>
          <label className="timeline-date">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={todayStr}
              onChange={(e) => onChange({ from: dateFrom, to: e.target.value })}
            />
          </label>
        </div>
        <label className="timeline-toggle" title="Show or hide fires that are out (historical)">
          <span
            className={`toggle-track ${showHistorical ? 'on' : ''}`}
            role="switch"
            aria-checked={showHistorical}
            onClick={onToggleHistorical}
          >
            <span className="toggle-thumb" />
          </span>
          <span className="timeline-toggle-label">Historical</span>
        </label>
        <span className="timeline-readout">
          {hasRange
            ? `${shortDate(fromMs ?? domain.min)} – ${shortDate(toMs ?? domain.max)}`
            : 'All time'}
          <span className="timeline-count">{inRangeCount} incident{inRangeCount === 1 ? '' : 's'}</span>
        </span>
        {hasRange && (
          <button className="timeline-reset" onClick={() => onChange({ from: '', to: '' })}>
            Reset
          </button>
        )}
      </div>

      <div className="timeline-track" ref={trackRef} onPointerDown={onTrackPointerDown}>
        <div className="timeline-ticks">
          {ticks.map((tk) => {
            const active = tk.frac >= fromFrac && tk.frac <= toFrac
            return (
              <span
                key={tk.id}
                className={`timeline-tick ${active ? 'active' : ''}`}
                style={{ left: `${tk.frac * 100}%`, background: tk.color }}
              />
            )
          })}
        </div>
        <div
          className="timeline-selection"
          style={{ left: `${fromFrac * 100}%`, width: `${(toFrac - fromFrac) * 100}%` }}
        />
        <button
          className={`timeline-handle ${dragging === 'from' ? 'active' : ''}`}
          style={{ left: `${fromFrac * 100}%` }}
          onPointerDown={(e) => { e.stopPropagation(); beginDrag('from', e) }}
          aria-label="Adjust start of range"
        />
        <button
          className={`timeline-handle ${dragging === 'to' ? 'active' : ''}`}
          style={{ left: `${toFrac * 100}%` }}
          onPointerDown={(e) => { e.stopPropagation(); beginDrag('to', e) }}
          aria-label="Adjust end of range"
        />
      </div>

      <div className="timeline-axis">
        <span>{shortDate(domain.min)}</span>
        <span>{shortDate(domain.max)}</span>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { MAP_LAYERS } from '../lib/mapLayers'
import { MEASURE_MODES } from './MeasureTool'

function Icon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'layers':
      return (
        <svg {...common}>
          <path d="M12 2 2 7l10 5 10-5-10-5z" />
          <path d="M2 12l10 5 10-5" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      )
    case 'ruler':
      return (
        <svg {...common}>
          <path d="M3 17 17 3l4 4L7 21z" />
          <path d="M7 11l2 2M11 7l2 2M15 5l2 2" />
        </svg>
      )
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z" />
        </svg>
      )
    case 'heat':
      return (
        <svg {...common}>
          <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    default:
      return null
  }
}

export default function MapControls({ layerId, onLayerChange, measureMode, onMeasureChange, placingFavorite, onToggleFavorite, showHeatmap, onToggleHeatmap }) {
  const [openPanel, setOpenPanel] = useState(null)

  const togglePanel = (name) => {
    setOpenPanel((cur) => (cur === name ? null : name))
  }

  const isMeasuring = measureMode !== MEASURE_MODES.none

  return (
    <div className="map-controls">
      <div className="control-bar">
        <button
          className={`control-btn ${openPanel === 'layers' ? 'active' : ''}`}
          onClick={() => togglePanel('layers')}
          title="Map layers"
          aria-label="Switch map layer"
        >
          <Icon name="layers" />
        </button>
        <button
          className={`control-btn ${isMeasuring ? 'active' : ''}`}
          onClick={() => togglePanel('measure')}
          title="Measure"
          aria-label="Measurement tools"
        >
          <Icon name="ruler" />
        </button>
        <button
          className={`control-btn ${placingFavorite ? 'active fav' : ''}`}
          onClick={onToggleFavorite}
          title={placingFavorite ? 'Click the map to drop a favorite' : 'Add favorite location'}
          aria-label="Add favorite location"
        >
          <Icon name="star" />
        </button>
        <button
          className={`control-btn ${showHeatmap ? 'active heat' : ''}`}
          onClick={onToggleHeatmap}
          title={showHeatmap ? 'Hide wildfire risk heatmap' : 'Show wildfire risk heatmap'}
          aria-label="Toggle wildfire risk heatmap"
        >
          <Icon name="heat" />
        </button>
      </div>

      {openPanel === 'layers' && (
        <div className="control-panel">
          <div className="panel-head">
            <span>Base map</span>
            <button className="panel-close" onClick={() => setOpenPanel(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="layer-options">
            {MAP_LAYERS.map((layer) => (
              <button
                key={layer.id}
                className={`layer-option ${layerId === layer.id ? 'selected' : ''}`}
                onClick={() => {
                  onLayerChange(layer.id)
                  setOpenPanel(null)
                }}
              >
                <span className="layer-name">{layer.name}</span>
                <span className="layer-desc">{layer.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {openPanel === 'measure' && (
        <div className="control-panel">
          <div className="panel-head">
            <span>Measure</span>
            <button className="panel-close" onClick={() => setOpenPanel(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="measure-options">
            <button
              className={`measure-option ${measureMode === MEASURE_MODES.ruler ? 'selected' : ''}`}
              onClick={() => onMeasureChange(MEASURE_MODES.ruler)}
            >
              <Icon name="ruler" />
              <div>
                <div className="option-title">Ruler (distance)</div>
                <div className="option-desc">Click points to measure a path</div>
              </div>
            </button>
            <button
              className={`measure-option ${measureMode === MEASURE_MODES.circle ? 'selected' : ''}`}
              onClick={() => onMeasureChange(MEASURE_MODES.circle)}
            >
              <Icon name="circle" />
              <div>
                <div className="option-title">Circle (radius + area)</div>
                <div className="option-desc">Click center, move to size</div>
              </div>
            </button>
            {isMeasuring && (
              <button
                className="measure-option stop"
                onClick={() => {
                  onMeasureChange(MEASURE_MODES.none)
                  setOpenPanel(null)
                }}
              >
                <Icon name="close" />
                <div>
                  <div className="option-title">Stop measuring</div>
                  <div className="option-desc">Clears the current measurement</div>
                </div>
              </button>
            )}
          </div>
          <div className="measure-hint-text">
            {measureMode === MEASURE_MODES.ruler
              ? 'Click on the map to add points. Readout updates live.'
              : measureMode === MEASURE_MODES.circle
                ? 'Click the center, then move the mouse to set the radius.'
                : 'Choose a tool above to start measuring.'}
          </div>
        </div>
      )}
    </div>
  )
}

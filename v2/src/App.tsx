import { useMemo, useState } from 'react'
import { useFires, useHotspots } from './data/hooks'
import { useRealtimeSync } from './data/realtime'
import { isDemo } from './data/fires'
import { deriveAlerts } from './domain'
import { useTheme } from './lib/theme'
import { useUnits } from './lib/units'
import { useKeyLocations } from './hooks/useKeyLocations'
import { FireMap, type MapMode } from './map/FireMap'
import { IncidentList } from './components/IncidentList'
import { AlertsList } from './components/AlertsList'
import { PlacesList } from './components/PlacesList'
import { IncidentDetail } from './components/IncidentDetail'

type LeftTab = 'incidents' | 'alerts' | 'places'

export default function App() {
  useRealtimeSync()
  const { data: fires = [], isLoading, isError, error } = useFires()
  const { theme, toggle: toggleTheme } = useTheme()
  const { units, toggle: toggleUnits } = useUnits()
  const { locations, add: addLocation, remove: removeLocation } = useKeyLocations()

  const [showHotspots, setShowHotspots] = useState(true)
  const { data: hotspots = [] } = useHotspots(showHotspots)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('incidents')
  const [mode, setMode] = useState<MapMode>('select')

  const alerts = useMemo(() => deriveAlerts(fires), [fires])
  const selected = fires.find((f) => f.id === selectedId) ?? null

  const handlePlace = (lat: number, lng: number) => {
    addLocation(lat, lng)
    setMode('select')
  }
  const toggleMeasure = () => setMode((m) => (m === 'measure' ? 'select' : 'measure'))
  const togglePlacing = () => setMode((m) => (m === 'place' ? 'select' : 'place'))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden />
          Wildfire Command <span className="ver">v2</span>
        </div>
        <div className="top-meta">
          <span className="count">{fires.length} incidents</span>
          {isDemo && <span className="demo" title="No Supabase project configured — showing sample data">demo data</span>}
          <button className="toggle-btn" onClick={toggleUnits} type="button" title="Toggle units">{units === 'imperial' ? 'mi · ac' : 'km · ha'}</button>
          <button className="toggle-btn" onClick={toggleTheme} type="button" title="Toggle theme">{theme === 'dark' ? '☾' : '☀'}</button>
        </div>
      </header>

      {isError && <div className="banner error">Could not load incidents: {(error as Error).message}</div>}

      <div className="console">
        <aside className="sidebar">
          <div className="tabs">
            <button className={`tab ${leftTab === 'incidents' ? 'active' : ''}`} onClick={() => setLeftTab('incidents')} type="button">Incidents <span className="tab-count">{fires.length}</span></button>
            <button className={`tab ${leftTab === 'alerts' ? 'active' : ''}`} onClick={() => setLeftTab('alerts')} type="button">Alerts <span className="tab-count alert">{alerts.length}</span></button>
            <button className={`tab ${leftTab === 'places' ? 'active' : ''}`} onClick={() => setLeftTab('places')} type="button">Places <span className="tab-count">{locations.length}</span></button>
          </div>
          {leftTab === 'incidents' && <IncidentList fires={fires} selectedId={selectedId} onSelect={setSelectedId} loading={isLoading} />}
          {leftTab === 'alerts' && <AlertsList alerts={alerts} onSelect={(id) => { setSelectedId(id); setLeftTab('incidents') }} />}
          {leftTab === 'places' && <PlacesList locations={locations} placing={mode === 'place'} onTogglePlacing={togglePlacing} onRemove={removeLocation} />}
        </aside>

        <div className="map-wrap">
          <FireMap
            fires={fires} hotspots={hotspots} showHotspots={showHotspots}
            selectedId={selectedId} onSelect={setSelectedId}
            mode={mode} units={units} keyLocations={locations} onPlaceLocation={handlePlace}
          />
          <div className="map-tools">
            <button className={`map-toggle ${showHotspots ? 'on' : ''}`} onClick={() => setShowHotspots((v) => !v)} type="button">
              <span className="toggle-dot" /> FIRMS hotspots
              {hotspots.length > 0 && <span className="toggle-count">{hotspots.length.toLocaleString()}</span>}
            </button>
            <button className={`map-toggle ${mode === 'measure' ? 'on' : ''}`} onClick={toggleMeasure} type="button">
              <span className="toggle-dot" /> Measure
            </button>
          </div>
        </div>

        {selected && <IncidentDetail fire={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useFires, useHotspots } from './data/hooks'
import { useRealtimeSync } from './data/realtime'
import { dataMode } from './data/fires'
import { derivePlaceAlerts, firesWithinRadius, itemsInViewport, kmToMiles, type Bounds, type SavedPlace } from './domain'
import { useTheme } from './lib/theme'
import { useUnits } from './lib/units'
import { useNotificationSound } from './lib/notificationSound'
import { useKeyLocations } from './hooks/useKeyLocations'
import { usePlaceAlerts } from './hooks/usePlaceAlerts'
import { recordObservations } from './lib/fireHistory'
import { BASEMAPS, DEFAULT_BASEMAP_ID } from './lib/basemaps'
import { FireMap, type MapMode } from './map/FireMap'
import { IncidentList } from './components/IncidentList'
import { AlertsList } from './components/AlertsList'
import { PlacesList } from './components/PlacesList'
import { IncidentDetail } from './components/IncidentDetail'
import { SettingsModal, type SettingsSection } from './components/SettingsModal'
import { APP_VERSION } from './content'

type LeftTab = 'incidents' | 'alerts' | 'places'

export default function App() {
  useRealtimeSync()
  const { data: fires = [], isLoading, isError, error } = useFires()
  const { theme, toggle: toggleTheme } = useTheme()
  const { units, toggle: toggleUnits } = useUnits()
  const { locations, add: addLocation, update: updateLocation, remove: removeLocation, clear: clearLocations } = useKeyLocations()
  const { soundEnabled, volume } = useNotificationSound()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')

  // First run → show the FAQ so new users learn the system. Returning users get
  // the What's-new changelog whenever the app version has changed since they last
  // opened it. Both keys persist in localStorage so this fires at most once each.
  useEffect(() => {
    const seen = localStorage.getItem('wc-seen')
    const lastVersion = localStorage.getItem('wc-last-version')
    if (!seen) {
      setSettingsSection('faq')
      setSettingsOpen(true)
    } else if (lastVersion !== APP_VERSION) {
      setSettingsSection('whatsnew')
      setSettingsOpen(true)
    }
    localStorage.setItem('wc-seen', '1')
    localStorage.setItem('wc-last-version', APP_VERSION)
  }, [])

  const [showHotspots, setShowHotspots] = useState(true)
  const { data: hotspots = [] } = useHotspots(showHotspots)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Record observed changes to each incident on every fetch, building a
  // browser-local change history (no backend). Bump a tick when something
  // changed so the open detail panel re-reads the log.
  const [historyVersion, setHistoryVersion] = useState(0)
  useEffect(() => {
    if (fires.length === 0) return
    if (recordObservations(fires) > 0) setHistoryVersion((v) => v + 1)
  }, [fires])
  const [leftTab, setLeftTab] = useState<LeftTab>('incidents')
  const [mode, setMode] = useState<MapMode>('select')
  const [basemapId, setBasemapId] = useState(() => {
    const saved = localStorage.getItem('wc-basemap')
    return saved && BASEMAPS.some((b) => b.id === saved) ? saved : DEFAULT_BASEMAP_ID
  })
  useEffect(() => { localStorage.setItem('wc-basemap', basemapId) }, [basemapId])

  // The incident list mirrors what's on the map: only fires inside the current
  // viewport. FireMap emits its bounds on every pan/zoom; until the first emit
  // (map still loading) we show everything.
  const [viewBounds, setViewBounds] = useState<Bounds | null>(null)
  const visibleFires = useMemo(
    () => (viewBounds ? itemsInViewport(fires, viewBounds) : fires),
    [fires, viewBounds],
  )

  // Selecting a saved place filters the list to fires within that place's alert
  // radius (and frames the map to it) instead of the viewport.
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const focusedPlace = useMemo(
    () => locations.find((p) => p.id === selectedPlaceId) ?? null,
    [locations, selectedPlaceId],
  )
  const incidentsForList = useMemo(
    () => (focusedPlace ? firesWithinRadius(fires, focusedPlace).map((x) => x.fire) : visibleFires),
    [focusedPlace, fires, visibleFires],
  )
  const mapFocus = useMemo(
    () => (focusedPlace ? { lat: focusedPlace.lat, lng: focusedPlace.lng, radiusKm: focusedPlace.alertRadiusKm } : null),
    [focusedPlace],
  )
  const radiusLabel = focusedPlace
    ? units === 'metric' ? `${Math.round(focusedPlace.alertRadiusKm)} km` : `${Math.round(kmToMiles(focusedPlace.alertRadiusKm))} mi`
    : ''
  const focusPlace = (place: SavedPlace) => { setSelectedPlaceId(place.id); setLeftTab('incidents') }

  // Alerts panel: only fires near a saved place or of extreme severity.
  const alerts = useMemo(() => derivePlaceAlerts(fires, locations, units), [fires, locations, units])
  const selected = fires.find((f) => f.id === selectedId) ?? null

  // OS notifications (+ chime) when a fire enters an alert-enabled place's radius.
  usePlaceAlerts(fires, locations, { enabled: soundEnabled, volume })

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
          {dataMode === 'live' && <span className="live" title="Live data fetched directly from NIFC WFIGS — no backend">live · WFIGS</span>}
          {dataMode === 'demo' && <span className="demo" title="Bundled sample data (VITE_DATA_MODE=demo)">demo data</span>}
          <button className="toggle-btn" onClick={toggleUnits} type="button" title="Toggle units">{units === 'imperial' ? 'mi · ac' : 'km · ha'}</button>
          <button className="toggle-btn" onClick={toggleTheme} type="button" title="Toggle theme">{theme === 'dark' ? '☾' : '☀'}</button>
          <button className="toggle-btn" onClick={() => { setSettingsSection('general'); setSettingsOpen(true) }} type="button" title="Settings" aria-label="Settings">⚙</button>
        </div>
      </header>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSection={settingsSection}
        basemapId={basemapId}
        onSetBasemap={setBasemapId}
        placeCount={locations.length}
        onClearPlaces={clearLocations}
      />

      {isError && <div className="banner error">Could not load incidents: {(error as Error).message}</div>}

      <div className="console">
        <aside className="sidebar">
          <div className="tabs">
            <button className={`tab ${leftTab === 'incidents' ? 'active' : ''}`} onClick={() => setLeftTab('incidents')} type="button">Incidents <span className="tab-count">{incidentsForList.length}</span></button>
            <button className={`tab ${leftTab === 'alerts' ? 'active' : ''}`} onClick={() => setLeftTab('alerts')} type="button">Alerts <span className="tab-count alert">{alerts.length}</span></button>
            <button className={`tab ${leftTab === 'places' ? 'active' : ''}`} onClick={() => setLeftTab('places')} type="button">Places <span className="tab-count">{locations.length}</span></button>
          </div>
          {leftTab === 'incidents' && (
            <IncidentList
              fires={incidentsForList} selectedId={selectedId} onSelect={setSelectedId} loading={isLoading}
              total={focusedPlace ? undefined : fires.length}
              focus={focusedPlace ? { label: `Within ${radiusLabel} of ${focusedPlace.name}`, onClear: () => setSelectedPlaceId(null) } : undefined}
            />
          )}
          {leftTab === 'alerts' && <AlertsList alerts={alerts} onSelect={(id) => { setSelectedId(id); setLeftTab('incidents') }} />}
          {leftTab === 'places' && (
            <PlacesList
              locations={locations} fires={fires} units={units} selectedId={selectedPlaceId}
              placing={mode === 'place'} onTogglePlacing={togglePlacing}
              onAdd={addLocation} onUpdate={updateLocation} onRemove={removeLocation} onFocus={focusPlace}
            />
          )}
        </aside>

        <div className="map-wrap">
          <FireMap
            fires={fires} hotspots={hotspots} showHotspots={showHotspots}
            selectedId={selectedId} onSelect={setSelectedId}
            mode={mode} units={units} keyLocations={locations} onPlaceLocation={handlePlace}
            onBoundsChange={setViewBounds} focusPlace={mapFocus}
            basemapId={basemapId}
          />
          <div className="map-tools">
            <button className={`map-toggle ${showHotspots ? 'on' : ''}`} onClick={() => setShowHotspots((v) => !v)} type="button">
              <span className="toggle-dot" /> FIRMS hotspots
              {hotspots.length > 0 && <span className="toggle-count">{hotspots.length.toLocaleString()}</span>}
            </button>
            <button className={`map-toggle ${mode === 'measure' ? 'on' : ''}`} onClick={toggleMeasure} type="button">
              <span className="toggle-dot" /> Measure
            </button>
            <select className="basemap-select" value={basemapId} onChange={(e) => setBasemapId(e.target.value)} aria-label="Basemap">
              {BASEMAPS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
        </div>

        {selected && <IncidentDetail fire={selected} places={locations} historyVersion={historyVersion} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}

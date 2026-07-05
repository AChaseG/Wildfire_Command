import { useState, useMemo, useEffect, useCallback } from 'react'
import FireMap from './components/FireMap'
import FireList from './components/FireList'
import FireDetail from './components/FireDetail'
import UpdatesFeed from './components/UpdatesFeed'
import MapControls from './components/MapControls'
import MapTimeline from './components/MapTimeline'
import AlertsFeed from './components/AlertsFeed'
import CustomFeedsPane from './components/CustomFeedsPane'
import AlertRulesModal from './components/AlertRulesModal'
import DataSourcesModal from './components/DataSourcesModal'
import AddSocialAlertModal from './components/AddSocialAlertModal'
import KeyLocationsModal from './components/KeyLocationsModal'
import FavoriteNamePrompt from './components/FavoriteNamePrompt'
import SettingsModal from './components/SettingsModal'
import AlertDetailFloat from './components/AlertDetailFloat'
import { MEASURE_MODES } from './components/MeasureTool'
import { useWildfires, useFireUpdates } from './hooks/useWildfires'
import { useAlerts, useAlertRules } from './hooks/useAlerts'
import { useDataSources } from './hooks/useDataSources'
import { useKeyLocations } from './hooks/useKeyLocations'
import { useFireRisk } from './hooks/useFireRisk'
import { useResizablePanels } from './hooks/useResizablePanels'
import { useNotificationChime } from './hooks/useNotificationChime'
import { useNotificationSettings } from './hooks/useNotificationSettings'
import { useIncidentMonitor } from './hooks/useIncidentMonitor'
import { useUnits } from './context/UnitsContext'
import { useTheme } from './context/ThemeContext'
import { filterFires } from './lib/fireUtils'
import { playAlertChime } from './lib/chime'
import { MAP_LAYERS } from './lib/mapLayers'
import './App.css'

const DEFAULT_LAYER_KEY = 'wc-default-layer'

function initialLayer() {
  const saved = localStorage.getItem(DEFAULT_LAYER_KEY)
  if (saved && MAP_LAYERS.some((l) => l.id === saved)) return saved
  return 'satellite'
}

export default function App() {
  const { fires, loading, error, setMonitored, refresh: refreshFires } = useWildfires()
  const { units, setUnits } = useUnits()
  const { theme, setTheme } = useTheme()
  const { settings: notifSettings, save: saveNotifSettings } = useNotificationSettings()
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showHistorical, setShowHistorical] = useState(true)
  const [mapBounds, setMapBounds] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const { cells: riskCells, loading: riskLoading, error: riskError } = useFireRisk(mapBounds, showHeatmap)
  const [layerId, setLayerId] = useState(initialLayer)
  const [defaultLayer, setDefaultLayer] = useState(initialLayer)
  const [measureMode, setMeasureMode] = useState(MEASURE_MODES.none)
  const [measureKey, setMeasureKey] = useState(0)
  const [rightTab, setRightTab] = useState('incident')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [socialOpen, setSocialOpen] = useState(false)
  const [keyLocOpen, setKeyLocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [placingFavorite, setPlacingFavorite] = useState(false)
  const [pendingFavorite, setPendingFavorite] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('wc-sound') === 'on')

  useNotificationChime(soundOn)
  useIncidentMonitor(fires, notifSettings)

  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const next = !v
      localStorage.setItem('wc-sound', next ? 'on' : 'off')
      if (next) playAlertChime()
      return next
    })
  }, [])

  const handleSetDefaultLayer = useCallback((id) => {
    localStorage.setItem(DEFAULT_LAYER_KEY, id)
    setDefaultLayer(id)
    setLayerId(id)
  }, [])

  const { leftW, rightW, startResizeLeft, startResizeRight } = useResizablePanels()

  const {
    alerts,
    loading: alertsLoading,
    error: alertsError,
    acknowledge,
    acknowledgeAll,
    deleteAlert,
    createAlert,
    refresh: refreshAlerts,
  } = useAlerts()
  const {
    rules,
    loading: rulesLoading,
    createRule,
    updateRule,
    deleteRule,
    generateAlertsForRule,
  } = useAlertRules()
  const {
    sources,
    loading: sourcesLoading,
    createSource,
    updateSource,
    deleteSource,
  } = useDataSources()
  const {
    locations: keyLocations,
    loading: keyLocLoading,
    createLocation,
    updateLocation,
    deleteLocation,
  } = useKeyLocations()

  const unackCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts],
  )

  const selectedFire = useMemo(
    () => fires.find((f) => f.id === selectedId) || null,
    [fires, selectedId],
  )

  const currentFires = useMemo(() => fires.filter((f) => f.status !== 'out'), [fires])
  const mapFires = useMemo(
    () => filterFires(showHistorical ? fires : currentFires, filter, dateFrom, dateTo),
    [fires, currentFires, showHistorical, filter, dateFrom, dateTo],
  )
  const listFires = useMemo(() => {
    const base = filterFires(currentFires, filter, '', '')
    if (!mapBounds) return base
    return base.filter((f) => mapBounds.contains([f.latitude, f.longitude]))
  }, [currentFires, filter, mapBounds])
  const { updates, loading: updatesLoading, error: updatesError } = useFireUpdates(selectedId)

  const handleSelect = (id) => {
    setSelectedId(id)
    setRightTab('incident')
  }
  const handleClose = () => setSelectedId(null)
  const handleMeasureChange = (mode) => {
    setMeasureMode(mode)
    if (mode === MEASURE_MODES.none) setMeasureKey((k) => k + 1)
  }
  const handleClearMeasure = () => {
    setMeasureMode(MEASURE_MODES.none)
    setMeasureKey((k) => k + 1)
  }

  const handleGenerate = async (rule, fireList) => {
    const count = await generateAlertsForRule(rule, fireList)
    if (count > 0) refreshAlerts()
    return count
  }

  const relatedAlerts = useMemo(
    () => (selectedId ? alerts.filter((a) => a.fire_id === selectedId) : []),
    [alerts, selectedId],
  )

  // Fire connected to the selected alert (for floating panel)
  const alertFire = useMemo(
    () => (selectedAlert?.fire_id ? fires.find((f) => f.id === selectedAlert.fire_id) || null : null),
    [selectedAlert, fires],
  )

  // Continuously scan every configured source (GDACS RSS + social media)
  // on an interval so alerts populate globally without manual action.
  const scanAllSources = useCallback(async () => {
    const base = import.meta.env.VITE_SUPABASE_URL
    const headers = {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }
    setScanning(true)
    try {
      await Promise.allSettled([
        fetch(`${base}/functions/v1/fetch-external-alerts`, { method: 'POST', headers }),
        fetch(`${base}/functions/v1/scan-social-feeds`, { method: 'POST', headers }),
        fetch(`${base}/functions/v1/fetch-nasa-firms`, { method: 'POST', headers }),
        fetch(`${base}/functions/v1/fetch-wildfire-incidents`, { method: 'POST', headers }),
        fetch(`${base}/functions/v1/fetch-purpleair`, { method: 'POST', headers }),
      ])
      // Realtime pushes new rows, but refresh guards against missed events.
      refreshAlerts()
      refreshFires()
    } catch {
      // transient failure — the next interval will retry
    } finally {
      setScanning(false)
    }
  }, [refreshAlerts, refreshFires])

  useEffect(() => {
    scanAllSources()
    const id = setInterval(scanAllSources, 120000)
    return () => clearInterval(id)
  }, [scanAllSources])

  const handlePlaceFavorite = useCallback((coord) => {
    setPendingFavorite(coord)
    setPlacingFavorite(false)
  }, [])

  const handleBoundsChange = useCallback((bounds) => {
    setMapBounds(bounds)
  }, [])

  const handleSaveFavorite = useCallback(async (loc) => {
    const created = await createLocation(loc)
    if (created) setPendingFavorite(null)
    return Boolean(created)
  }, [createLocation])

  const enabledSources = useMemo(() => sources.filter((s) => s.enabled), [sources])

  const kmlSources = useMemo(
    () => sources.filter((s) => s.source_kind === 'kml' && s.visible !== false && s.kml_content),
    [sources],
  )

  const firmsDetections = useMemo(
    () => alerts.filter((a) => a.source === 'NASA FIRMS' && a.latitude != null && a.longitude != null),
    [alerts],
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 9 7 11 7 13a5 5 0 0 0 10 0c0-4-3-7-5-11z" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>Wildfire Command</h1>
            <span className="brand-sub">Real-time incident tracking · Worldwide</span>
          </div>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="header-stat-value">{fires.filter((f) => f.status === 'active').length}</span>
            <span className="header-stat-label">Active</span>
          </div>
          <button
            className={`header-stat alerts-stat ${unackCount > 0 ? 'has-alerts' : ''}`}
            onClick={() => setRightTab('alerts')}
            title="View alerts"
          >
            <span className="header-stat-value">
              {unackCount}
              {unackCount > 0 && <span className="alert-pulse" />}
            </span>
            <span className="header-stat-label">Alerts</span>
          </button>
          <button
            className="header-stat header-stat-btn"
            onClick={() => setKeyLocOpen(true)}
            title="Key locations"
          >
            <span className="header-stat-value">{keyLocations.length}</span>
            <span className="header-stat-label">Locations</span>
          </button>
          <button
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className="app-body"
        style={{ gridTemplateColumns: `${leftW}px 5px minmax(0, 1fr) 5px ${rightW}px` }}
      >
        <aside className="panel left">
          <FireList
            fires={listFires}
            totalCount={currentFires.length}
            selectedId={selectedId}
            onSelect={handleSelect}
            filter={filter}
            onFilter={setFilter}
          />
        </aside>

        <div className="resize-handle left-handle" onMouseDown={startResizeLeft} />

        <main className="map-wrap">
          {loading && <div className="map-overlay">Loading incidents…</div>}
          {error && <div className="map-overlay error">Failed to load: {error}</div>}
          {!loading && (
            <FireMap
              key={measureKey}
              fires={mapFires}
              selectedId={selectedId}
              onSelect={handleSelect}
              layerId={layerId}
              measureMode={measureMode}
              onClearMeasure={handleClearMeasure}
              keyLocations={keyLocations}
              placingFavorite={placingFavorite}
              onPlaceFavorite={handlePlaceFavorite}
              onBoundsChange={handleBoundsChange}
              showHeatmap={showHeatmap}
              riskCells={riskCells}
              kmlSources={kmlSources}
              firmsDetections={firmsDetections}
            />
          )}
          <MapControls
            layerId={layerId}
            onLayerChange={setLayerId}
            measureMode={measureMode}
            onMeasureChange={handleMeasureChange}
            placingFavorite={placingFavorite}
            onToggleFavorite={() => setPlacingFavorite((v) => !v)}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((v) => !v)}
          />
          {placingFavorite && (
            <div className="fav-placing-hint">
              <span className="fav-star-inline">★</span>
              Click anywhere on the map to drop a favorite location
              <button className="fav-hint-cancel" onClick={() => setPlacingFavorite(false)}>Cancel</button>
            </div>
          )}
          {/* Live scanning indicator */}
          <div className={`live-scan-badge ${scanning ? 'active' : ''}`} title="Automatically scanning all sources including social media">
            <span className="live-scan-dot" />
            {scanning ? 'Scanning sources…' : 'Live · all sources'}
          </div>
          <div className="map-legend">
            <div className="legend-title">Severity</div>
            <div className="legend-items">
              <span className="legend-item"><span className="dot" style={{ background: '#3fb950' }} /> Low</span>
              <span className="legend-item"><span className="dot" style={{ background: '#f0a020' }} /> Moderate</span>
              <span className="legend-item"><span className="dot" style={{ background: '#f85149' }} /> High</span>
              <span className="legend-item"><span className="dot" style={{ background: '#a01a1a' }} /> Extreme</span>
            </div>
            {firmsDetections.length > 0 && (
              <div className="legend-items">
                <span className="legend-item"><span className="dot ring" style={{ background: '#f97316' }} /> NASA FIRMS hotspot ({firmsDetections.length})</span>
              </div>
            )}
            <div className="legend-note">Flame markers are incidents (colored by severity); small dots are live NASA FIRMS satellite hotspots. Data: GDACS, NASA FIRMS, Reddit, and regional agencies worldwide.</div>
          </div>
          {showHeatmap && (
            <div className="heat-legend">
              <div className="legend-title">
                Fire-weather risk
                {riskLoading && <span className="heat-loading"> · updating…</span>}
              </div>
              <div className="heat-scale" />
              <div className="heat-scale-labels">
                <span>Lower</span>
                <span>Higher</span>
              </div>
              <div className="legend-note">
                {riskError
                  ? `Risk data unavailable: ${riskError}`
                  : 'Live predictive model from temperature, humidity, wind, precipitation & soil (fuel) moisture — Open-Meteo.'}
              </div>
            </div>
          )}
          <MapTimeline
            fires={fires}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showHistorical={showHistorical}
            onToggleHistorical={() => setShowHistorical((v) => !v)}
            onChange={({ from, to }) => { setDateFrom(from); setDateTo(to) }}
          />
        </main>

        <div className="resize-handle right-handle" onMouseDown={startResizeRight} />

        <aside className="panel right">
          <div className="right-tabs">
            <button
              className={`right-tab ${rightTab === 'incident' ? 'active' : ''}`}
              onClick={() => setRightTab('incident')}
            >
              Incident
            </button>
            <button
              className={`right-tab ${rightTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setRightTab('alerts')}
            >
              Alerts
              {unackCount > 0 && <span className="tab-badge">{unackCount}</span>}
            </button>
            <button
              className={`right-tab ${rightTab === 'feeds' ? 'active' : ''}`}
              onClick={() => setRightTab('feeds')}
            >
              Feeds
            </button>
          </div>

          {rightTab === 'incident' && (
            <div className="panel-scroll">
              <FireDetail
                fire={selectedFire}
                onClose={handleClose}
                relatedAlerts={relatedAlerts}
                keyLocations={keyLocations}
                onSelectAlert={setSelectedAlert}
                onToggleMonitor={setMonitored}
              />
              {selectedFire && (
                <UpdatesFeed updates={updates} loading={updatesLoading} error={updatesError} />
              )}
            </div>
          )}

          {rightTab === 'alerts' && (
            <AlertsFeed
              alerts={alerts}
              loading={alertsLoading}
              error={alertsError}
              onAcknowledge={acknowledge}
              onAcknowledgeAll={acknowledgeAll}
              onDelete={deleteAlert}
              onOpenRules={() => setRulesOpen(true)}
              onAddSocial={() => setSocialOpen(true)}
              onFetchExternal={scanAllSources}
              fetchingExternal={scanning}
              onSelectFire={handleSelect}
              onViewDetail={setSelectedAlert}
              unackCount={unackCount}
            />
          )}

          {rightTab === 'feeds' && (
            <CustomFeedsPane
              alerts={alerts}
              rules={rules}
              onAcknowledge={acknowledge}
              onDelete={deleteAlert}
              onSelectFire={handleSelect}
              onViewDetail={setSelectedAlert}
              onOpenRules={() => setRulesOpen(true)}
            />
          )}
        </aside>
      </div>

      <footer className="app-footer">
        <span className="footer-label">Data sources ({enabledSources.length} active):</span>
        <div className="footer-sources">
          {enabledSources.slice(0, 8).map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="source-link" title={s.description || s.name}>
              {s.name}
            </a>
          ))}
          {enabledSources.length > 8 && (
            <span className="source-link more">+{enabledSources.length - 8} more</span>
          )}
        </div>
        <button className="manage-sources-btn" onClick={() => setSourcesOpen(true)}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Manage sources
        </button>
      </footer>

      <AlertRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={rules}
        loading={rulesLoading}
        onCreate={createRule}
        onUpdate={updateRule}
        onDelete={deleteRule}
        onGenerate={handleGenerate}
        fires={fires}
      />

      <DataSourcesModal
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        sources={sources}
        loading={sourcesLoading}
        onCreate={createSource}
        onUpdate={updateSource}
        onDelete={deleteSource}
      />

      <AddSocialAlertModal
        open={socialOpen}
        onClose={() => setSocialOpen(false)}
        onCreate={createAlert}
      />

      <KeyLocationsModal
        open={keyLocOpen}
        onClose={() => setKeyLocOpen(false)}
        locations={keyLocations}
        loading={keyLocLoading}
        onCreate={createLocation}
        onUpdate={updateLocation}
        onDelete={deleteLocation}
      />

      {selectedAlert && (
        <AlertDetailFloat
          alert={selectedAlert}
          fire={alertFire}
          onClose={() => setSelectedAlert(null)}
          onSelectFire={handleSelect}
        />
      )}

      <FavoriteNamePrompt
        coord={pendingFavorite}
        onSave={handleSaveFavorite}
        onCancel={() => setPendingFavorite(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onSetTheme={setTheme}
        units={units}
        onSetUnits={setUnits}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        defaultLayer={defaultLayer}
        onSetDefaultLayer={handleSetDefaultLayer}
        notifSettings={notifSettings}
        onSaveNotif={saveNotifSettings}
      />
    </div>
  )
}

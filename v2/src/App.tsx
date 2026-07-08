import { useMemo, useState } from 'react'
import { useFires, useHotspots } from './data/hooks'
import { useRealtimeSync } from './data/realtime'
import { isDemo } from './data/fires'
import { deriveAlerts } from './domain'
import { FireMap } from './map/FireMap'
import { IncidentList } from './components/IncidentList'
import { AlertsList } from './components/AlertsList'
import { IncidentDetail } from './components/IncidentDetail'

type LeftTab = 'incidents' | 'alerts'

export default function App() {
  useRealtimeSync()
  const { data: fires = [], isLoading, isError, error } = useFires()
  const [showHotspots, setShowHotspots] = useState(true)
  const { data: hotspots = [] } = useHotspots(showHotspots)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('incidents')

  const alerts = useMemo(() => deriveAlerts(fires), [fires])
  const selected = fires.find((f) => f.id === selectedId) ?? null

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
        </div>
      </header>

      {isError && <div className="banner error">Could not load incidents: {(error as Error).message}</div>}

      <div className="console">
        <aside className="sidebar">
          <div className="tabs">
            <button className={`tab ${leftTab === 'incidents' ? 'active' : ''}`} onClick={() => setLeftTab('incidents')} type="button">
              Incidents <span className="tab-count">{fires.length}</span>
            </button>
            <button className={`tab ${leftTab === 'alerts' ? 'active' : ''}`} onClick={() => setLeftTab('alerts')} type="button">
              Alerts <span className="tab-count alert">{alerts.length}</span>
            </button>
          </div>
          {leftTab === 'incidents' ? (
            <IncidentList fires={fires} selectedId={selectedId} onSelect={setSelectedId} loading={isLoading} />
          ) : (
            <AlertsList alerts={alerts} onSelect={(id) => { setSelectedId(id); setLeftTab('incidents') }} />
          )}
        </aside>

        <div className="map-wrap">
          <FireMap fires={fires} hotspots={hotspots} showHotspots={showHotspots} selectedId={selectedId} onSelect={setSelectedId} />
          <button
            className={`map-toggle ${showHotspots ? 'on' : ''}`}
            onClick={() => setShowHotspots((v) => !v)}
            type="button"
          >
            <span className="toggle-dot" /> FIRMS hotspots
            {hotspots.length > 0 && <span className="toggle-count">{hotspots.length.toLocaleString()}</span>}
          </button>
        </div>

        {selected && <IncidentDetail fire={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}

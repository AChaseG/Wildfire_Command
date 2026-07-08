import { useState } from 'react'
import { useFires } from './data/hooks'
import { isDemo } from './data/fires'
import { FireMap } from './map/FireMap'
import { IncidentList } from './components/IncidentList'
import { IncidentDetail } from './components/IncidentDetail'

export default function App() {
  const { data: fires = [], isLoading, isError, error } = useFires()
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
        <IncidentList fires={fires} selectedId={selectedId} onSelect={setSelectedId} loading={isLoading} />
        <FireMap fires={fires} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && <IncidentDetail fire={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}

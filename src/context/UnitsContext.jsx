import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { UNITS } from '../lib/units'

const UnitsContext = createContext({ units: UNITS.imperial, setUnits: () => {} })

const STORAGE_KEY = 'wildfire-command:units'

export function UnitsProvider({ children }) {
  const [units, setUnitsState] = useState(() => {
    if (typeof window === 'undefined') return UNITS.imperial
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === UNITS.metric || saved === UNITS.imperial ? saved : UNITS.imperial
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, units)
    } catch {
      // ignore storage failures
    }
  }, [units])

  const value = useMemo(() => ({ units, setUnits: setUnitsState }), [units])
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}

export function useUnits() {
  return useContext(UnitsContext)
}

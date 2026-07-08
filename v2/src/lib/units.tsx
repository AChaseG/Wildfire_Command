import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UnitSystem } from '../domain'

const UnitsContext = createContext<{ units: UnitSystem; toggle: () => void }>({ units: 'imperial', toggle: () => {} })

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<UnitSystem>(() =>
    localStorage.getItem('wc-units') === 'metric' ? 'metric' : 'imperial',
  )

  useEffect(() => {
    localStorage.setItem('wc-units', units)
  }, [units])

  const toggle = () => setUnits((u) => (u === 'imperial' ? 'metric' : 'imperial'))
  return <UnitsContext.Provider value={{ units, toggle }}>{children}</UnitsContext.Provider>
}

export function useUnits() {
  return useContext(UnitsContext)
}

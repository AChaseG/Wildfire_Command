import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// How long a fire may go without an update before it drops off the active view.
// Value is in hours; 0 = off (never drop anything).
export const DROP_OFF_OPTIONS: { hours: number; label: string }[] = [
  { hours: 0, label: 'Off (show all)' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 336, label: '14 days' },
  { hours: 720, label: '30 days' },
]

const STORAGE_KEY = 'wc-dropoff-hours'

export function dropOffLabel(hours: number): string {
  return DROP_OFF_OPTIONS.find((o) => o.hours === hours)?.label
    ?? (hours % 24 === 0 ? `${hours / 24} days` : `${hours}h`)
}

interface DropOffState {
  dropOffHours: number
  setDropOffHours: (h: number) => void
}

const DropOffContext = createContext<DropOffState>({ dropOffHours: 0, setDropOffHours: () => {} })

export function DropOffProvider({ children }: { children: ReactNode }) {
  const [dropOffHours, setDropOffHours] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const n = stored === null ? NaN : Number(stored)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })

  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(dropOffHours)) }, [dropOffHours])

  return <DropOffContext.Provider value={{ dropOffHours, setDropOffHours }}>{children}</DropOffContext.Provider>
}

export function useDropOff() {
  return useContext(DropOffContext)
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { normalizeBaseUrl } from '../data/transcriber'

// The base URL of the user's broadcastify-transcriber instance. Empty = the
// integration is off (no Scanner tab, nothing fetched). Persisted per browser.
const STORAGE_KEY = 'wc-transcriber-url'

interface TranscriberState {
  url: string
  setUrl: (u: string) => void
}

const TranscriberContext = createContext<TranscriberState>({ url: '', setUrl: () => {} })

export function TranscriberProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState(() => normalizeBaseUrl(localStorage.getItem(STORAGE_KEY) ?? ''))
  useEffect(() => { localStorage.setItem(STORAGE_KEY, url) }, [url])
  const setUrl = (u: string) => setUrlState(normalizeBaseUrl(u))
  return <TranscriberContext.Provider value={{ url, setUrl }}>{children}</TranscriberContext.Provider>
}

export function useTranscriber() {
  return useContext(TranscriberContext)
}

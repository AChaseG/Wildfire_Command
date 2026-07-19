import { useQuery } from '@tanstack/react-query'
import { fetchFires, fetchFireUpdates, fetchHotspots } from './fires'
import { fetchFireNews } from './fireNews'
import { fetchTransmissions } from './transcriber'
import type { Fire } from '../domain'

// Realtime (slice 4) will push into this same cache; for now a periodic refetch
// keeps the console current.
export function useFires() {
  return useQuery({
    queryKey: ['fires'],
    queryFn: fetchFires,
    refetchInterval: 120_000,
  })
}

export function useHotspots(enabled: boolean) {
  return useQuery({
    queryKey: ['hotspots'],
    queryFn: fetchHotspots,
    enabled,
    staleTime: 300_000,
  })
}

export function useFireUpdates(fireId: string | null) {
  return useQuery({
    queryKey: ['fire_updates', fireId],
    queryFn: () => fetchFireUpdates(fireId as string),
    enabled: fireId != null,
  })
}

// Nearby news for the selected incident (GDELT, keyless, browser-direct).
// Best-effort: cached 10 min, retried once, and its failure never blocks the UI.
export function useFireNews(fire: Fire | null) {
  return useQuery({
    queryKey: ['fire_news', fire?.id],
    queryFn: ({ signal }) => fetchFireNews(fire as Fire, signal),
    enabled: fire != null,
    staleTime: 600_000,
    retry: 1,
  })
}

// Scanner transmissions from the user's broadcastify-transcriber instance.
// Enabled only when a URL is configured; polls every 30s.
export function useScannerFeed(baseUrl: string) {
  return useQuery({
    queryKey: ['scanner', baseUrl],
    queryFn: ({ signal }) => fetchTransmissions(baseUrl, 100, signal),
    enabled: baseUrl.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  })
}

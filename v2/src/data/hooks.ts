import { useQuery } from '@tanstack/react-query'
import { fetchFires, fetchFireUpdates, fetchHotspots } from './fires'
import { fetchFireNews } from './fireNews'
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

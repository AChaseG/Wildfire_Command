import { useQuery } from '@tanstack/react-query'
import { fetchFires, fetchFireUpdates } from './fires'

// Realtime (slice 4) will push into this same cache; for now a periodic refetch
// keeps the console current.
export function useFires() {
  return useQuery({
    queryKey: ['fires'],
    queryFn: fetchFires,
    refetchInterval: 120_000,
  })
}

export function useFireUpdates(fireId: string | null) {
  return useQuery({
    queryKey: ['fire_updates', fireId],
    queryFn: () => fetchFireUpdates(fireId as string),
    enabled: fireId != null,
  })
}

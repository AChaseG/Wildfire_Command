import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../lib/supabase'
import { isDemo } from './fires'

// Subscribes to Postgres changes on fires/fire_updates and invalidates the
// affected queries so the console stays live without polling. No-op in demo
// mode (no backend to listen to).
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isDemo) return
    const supabase = getSupabase()
    const channel = supabase
      .channel('wildfire-console')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fires' }, () => {
        queryClient.invalidateQueries({ queryKey: ['fires'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fire_updates' }, () => {
        queryClient.invalidateQueries({ queryKey: ['fire_updates'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

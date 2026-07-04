import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { playAlertChime, playUpdateChime } from '../lib/chime'

// Plays a chime when a new alert arrives or an incident update is posted.
// Uses a ref for `enabled` so toggling never tears down the subscriptions.
export function useNotificationChime(enabled) {
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    const channel = supabase
      .channel('chime-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        () => {
          if (enabledRef.current) playAlertChime()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fire_updates' },
        () => {
          if (enabledRef.current) playUpdateChime()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

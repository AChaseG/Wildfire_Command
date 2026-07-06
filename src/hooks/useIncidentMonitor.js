import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CATEGORY_META } from '../lib/fireUtils'

// Watches for new incident updates. When an update lands on an incident the
// user has flagged as "monitored" and external notifications are enabled,
// relays the update to Slack via the edge function, which posts to the
// configured channel with a server-held bot token.
export function useIncidentMonitor(fires, settings) {
  const firesRef = useRef(fires)
  const settingsRef = useRef(settings)
  useEffect(() => {
    firesRef.current = fires
  }, [fires])
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const channel = supabase
      .channel('incident-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fire_updates' },
        (payload) => {
          const update = payload.new
          const cfg = settingsRef.current
          if (!cfg?.enabled || !cfg?.slack_channel_id) return
          const fire = firesRef.current.find((f) => f.id === update.fire_id)
          if (!fire || !fire.monitored) return

          const cat = CATEGORY_META[update.category]?.label || 'Update'
          const text = [
            `:fire: *${fire.name}* — new ${cat.toLowerCase()} update`,
            update.title ? `*${update.title}*` : null,
            update.content || null,
            fire.location_description ? `_${fire.location_description}_` : null,
          ]
            .filter(Boolean)
            .join('\n')

          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          }).catch(() => {
            // Best effort; a failed relay should never break the UI.
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

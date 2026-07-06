import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mutate } from '../lib/dbWrite'

const DEFAULTS = { id: 'default', slack_channel_id: '', enabled: false }

export function useNotificationSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('notification_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else if (data) setSettings({ ...DEFAULTS, ...data, slack_channel_id: data.slack_channel_id || '' })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async (patch) => {
    const next = { ...patch, updated_at: new Date().toISOString() }
    const { data, error } = await mutate({
      table: 'notification_settings', op: 'update', patch: next,
      match: { column: 'id', value: 'default' }, returning: 'maybeSingle',
    })
    if (error) {
      setError(error.message)
      return false
    }
    if (data) setSettings({ ...DEFAULTS, ...data, slack_channel_id: data.slack_channel_id || '' })
    return true
  }, [])

  return { settings, loading, error, save }
}

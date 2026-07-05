import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mutate } from '../lib/dbWrite'

export function useWildfires() {
  const [fires, setFires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('wildfires')
      .select('*')
      .order('started_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setFires(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setMonitored = useCallback(async (id, monitored) => {
    const { error } = await mutate({
      table: 'wildfires', op: 'update', patch: { monitored },
      match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return false
    }
    setFires((prev) => prev.map((f) => (f.id === id ? { ...f, monitored } : f)))
    return true
  }, [])

  return { fires, loading, error, refresh, setMonitored }
}

export function useFireUpdates(fireId) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fireId) {
      setUpdates([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = () =>
      supabase
        .from('fire_updates')
        .select('*')
        .eq('fire_id', fireId)
        .order('posted_at', { ascending: false })
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            setError(error.message)
          } else {
            setUpdates(data || [])
          }
          setLoading(false)
        })

    load()

    // New updates are inserted by the ingest edge function during scans; listen
    // for them so the feed reflects fire changes without re-selecting.
    const channel = supabase
      .channel(`fire_updates:${fireId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fire_updates', filter: `fire_id=eq.${fireId}` },
        (payload) => {
          setUpdates((prev) => {
            if (prev.some((u) => u.id === payload.new.id)) return prev
            return [payload.new, ...prev].sort(
              (a, b) => new Date(b.posted_at) - new Date(a.posted_at),
            )
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [fireId])

  return { updates, loading, error }
}

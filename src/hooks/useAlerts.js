import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mutate } from '../lib/dbWrite'
import { fireMatchesRule, buildAlertFromRule } from '../lib/geoUtils'

export function useAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('generated_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setAlerts(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Live global population: any alert inserted/updated/deleted anywhere
  // (edge-function scans, other clients, rule generation) shows up instantly.
  useEffect(() => {
    const channel = supabase
      .channel('alerts-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          setAlerts((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.some((a) => a.id === payload.new.id)) return prev
              return [payload.new, ...prev].sort(
                (a, b) => new Date(b.generated_at) - new Date(a.generated_at),
              )
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((a) => (a.id === payload.new.id ? payload.new : a))
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((a) => a.id !== payload.old.id)
            }
            return prev
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const acknowledge = useCallback(async (id) => {
    const { error } = await mutate({
      table: 'alerts', op: 'update',
      patch: { acknowledged: true, acknowledged_at: new Date().toISOString() },
      match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return
    }
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() }
          : a,
      ),
    )
  }, [])

  const acknowledgeAll = useCallback(async () => {
    const ids = alerts.filter((a) => !a.acknowledged).map((a) => a.id)
    if (ids.length === 0) return
    const { error } = await mutate({
      table: 'alerts', op: 'update',
      patch: { acknowledged: true, acknowledged_at: new Date().toISOString() },
      match: { column: 'id', in: ids },
    })
    if (error) {
      setError(error.message)
      return
    }
    setAlerts((prev) =>
      prev.map((a) =>
        a.acknowledged
          ? a
          : { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() },
      ),
    )
  }, [alerts])

  const deleteAlert = useCallback(async (id) => {
    const { error } = await mutate({
      table: 'alerts', op: 'delete', match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const createAlert = useCallback(async (alertData) => {
    const { data, error } = await mutate({
      table: 'alerts', op: 'insert',
      values: { ...alertData, acknowledged: false }, returning: 'single',
    })
    if (error) {
      setError(error.message)
      return null
    }
    setAlerts((prev) => [data, ...prev])
    return data
  }, [])

  return { alerts, loading, error, refresh, acknowledge, acknowledgeAll, deleteAlert, createAlert }
}

export function useAlertRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setRules(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createRule = useCallback(
    async (rule) => {
      const { data, error } = await mutate({
        table: 'alert_rules', op: 'insert', values: rule, returning: 'single',
      })
      if (error) {
        setError(error.message)
        return null
      }
      setRules((prev) => [data, ...prev])
      return data
    },
    [],
  )

  const updateRule = useCallback(
    async (id, patch) => {
      const { data, error } = await mutate({
        table: 'alert_rules', op: 'update', patch,
        match: { column: 'id', value: id }, returning: 'single',
      })
      if (error) {
        setError(error.message)
        return null
      }
      setRules((prev) => prev.map((r) => (r.id === id ? data : r)))
      return data
    },
    [],
  )

  const deleteRule = useCallback(async (id) => {
    const { error } = await mutate({
      table: 'alert_rules', op: 'delete', match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return
    }
    setRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const generateAlertsForRule = useCallback(async (rule, fires) => {
    if (!rule || !rule.enabled || !fires) return 0
    const matching = fires.filter((f) => fireMatchesRule(f, rule))
    if (matching.length === 0) return 0
    const alertsToInsert = matching.map((f) => ({
      rule_id: rule.id,
      fire_id: f.id,
      ...buildAlertFromRule(f, rule),
    }))
    const { error } = await mutate({
      table: 'alerts', op: 'insert', values: alertsToInsert,
    })
    if (error) {
      setError(error.message)
      return 0
    }
    return matching.length
  }, [])

  return { rules, loading, error, refresh, createRule, updateRule, deleteRule, generateAlertsForRule }
}

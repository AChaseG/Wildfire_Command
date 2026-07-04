import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mutate } from '../lib/dbWrite'

export function useDataSources() {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setSources(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createSource = useCallback(async (source) => {
    const { data, error } = await mutate({
      table: 'data_sources', op: 'insert', values: source, returning: 'single',
    })
    if (error) {
      setError(error.message)
      return null
    }
    setSources((prev) => [...prev, data])
    return data
  }, [])

  const updateSource = useCallback(async (id, patch) => {
    const { data, error } = await mutate({
      table: 'data_sources', op: 'update', patch,
      match: { column: 'id', value: id }, returning: 'single',
    })
    if (error) {
      setError(error.message)
      return null
    }
    setSources((prev) => prev.map((s) => (s.id === id ? data : s)))
    return data
  }, [])

  const deleteSource = useCallback(async (id) => {
    const { error } = await mutate({
      table: 'data_sources', op: 'delete', match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return
    }
    setSources((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return { sources, loading, error, refresh, createSource, updateSource, deleteSource }
}

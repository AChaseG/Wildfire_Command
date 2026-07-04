import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mutate } from '../lib/dbWrite'

export function useKeyLocations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('key_locations')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setLocations(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createLocation = useCallback(async (loc) => {
    const { data, error } = await mutate({
      table: 'key_locations', op: 'insert', values: loc, returning: 'single',
    })
    if (error) {
      setError(error.message)
      return null
    }
    setLocations((prev) => [...prev, data])
    return data
  }, [])

  const updateLocation = useCallback(async (id, updates) => {
    const { data, error } = await mutate({
      table: 'key_locations', op: 'update', patch: updates,
      match: { column: 'id', value: id }, returning: 'single',
    })
    if (error) {
      setError(error.message)
      return null
    }
    setLocations((prev) => prev.map((l) => (l.id === id ? data : l)))
    return data
  }, [])

  const deleteLocation = useCallback(async (id) => {
    const { error } = await mutate({
      table: 'key_locations', op: 'delete', match: { column: 'id', value: id },
    })
    if (error) {
      setError(error.message)
      return
    }
    setLocations((prev) => prev.filter((l) => l.id !== id))
  }, [])

  return { locations, loading, error, refresh, createLocation, updateLocation, deleteLocation }
}

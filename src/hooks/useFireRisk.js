import { useEffect, useRef, useState } from 'react'

// Fetches a predictive wildfire-risk field for the current map viewport from the
// fetch-fire-risk edge function (live fire-weather + fuel-moisture via Open-Meteo).
// Debounced so panning/zooming does not spam the API.
export function useFireRisk(bounds, enabled) {
  const [cells, setCells] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!enabled || !bounds) return
    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(async () => {
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      setLoading(true)
      setError(null)
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-fire-risk`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              minLat: sw.lat,
              minLng: sw.lng,
              maxLat: ne.lat,
              maxLng: ne.lng,
            }),
          },
        )
        if (!resp.ok) throw new Error(`Risk request failed (${resp.status})`)
        const data = await resp.json()
        if (!Array.isArray(data?.cells)) throw new Error('Malformed risk response')
        setCells(data.cells)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }, 650)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [bounds, enabled])

  return { cells, loading, error }
}

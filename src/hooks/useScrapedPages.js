import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useScrapedPages() {
  const [pages, setPages] = useState({})
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let active = true
    supabase
      .from('scraped_pages')
      .select('*')
      .then(({ data }) => {
        if (!active || !data) return
        const byId = {}
        for (const row of data) byId[row.data_source_id] = row
        setPages(byId)
      })
    return () => {
      active = false
    }
  }, [])

  const scrape = useCallback(async (sourceId, url) => {
    setBusy((prev) => ({ ...prev, [sourceId]: true }))
    setErrors((prev) => ({ ...prev, [sourceId]: null }))
    const { data, error } = await supabase.functions.invoke('scrape-source', {
      body: { id: sourceId, url },
    })
    setBusy((prev) => ({ ...prev, [sourceId]: false }))

    if (error || !data?.ok) {
      setErrors((prev) => ({ ...prev, [sourceId]: error?.message || data?.error || 'Extraction failed.' }))
      return null
    }
    setPages((prev) => ({ ...prev, [sourceId]: data.page }))
    if (data.page.status === 'error') {
      setErrors((prev) => ({ ...prev, [sourceId]: data.page.error || 'Extraction failed.' }))
    }
    return data.page
  }, [])

  return { pages, busy, errors, scrape }
}

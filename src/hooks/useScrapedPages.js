import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useScrapedPages() {
  const [pages, setPages] = useState({})
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})

  const reload = useCallback(async () => {
    const { data } = await supabase.from('scraped_pages').select('*')
    if (!data) return
    const byId = {}
    for (const row of data) byId[row.data_source_id] = row
    setPages(byId)
  }, [])

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

  const scrape = useCallback(async (source) => {
    const sourceId = source.id
    const isSearch = source.source_kind === 'search'
    setBusy((prev) => ({ ...prev, [sourceId]: true }))
    setErrors((prev) => ({ ...prev, [sourceId]: null }))
    const { data, error } = await supabase.functions.invoke(
      isSearch ? 'search-scrape' : 'scrape-source',
      { body: isSearch ? { id: sourceId, query: source.search_query } : { id: sourceId, url: source.url } },
    )
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

  const scrapeAll = useCallback(async () => {
    await Promise.allSettled([
      supabase.functions.invoke('scrape-source', { body: {} }),
      supabase.functions.invoke('search-scrape', { body: {} }),
    ])
    await reload()
  }, [reload])

  return { pages, busy, errors, scrape, scrapeAll, reload }
}

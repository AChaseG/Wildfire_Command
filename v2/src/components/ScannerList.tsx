import { useMemo, useState } from 'react'
import { useScannerFeed } from '../data/hooks'
import { isWildfireRelated } from '../data/transcriber'

function relativeTime(ts: string | null): string {
  if (!ts) return ''
  const ms = /^\d+$/.test(ts) ? Number(ts) * (ts.length <= 10 ? 1000 : 1) : Date.parse(ts)
  if (!Number.isFinite(ms)) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ScannerList({ url }: { url: string }) {
  const { data, isLoading, isError, error, isFetching } = useScannerFeed(url)
  const [fireOnly, setFireOnly] = useState(true)

  const all = data ?? []
  const shown = useMemo(() => (fireOnly ? all.filter((t) => isWildfireRelated(t.text)) : all), [all, fireOnly])

  return (
    <div className="list-inner">
      <div className="list-head">
        <div className="scanner-head">
          <button className={`chip ${fireOnly ? 'active' : ''}`} type="button" onClick={() => setFireOnly((v) => !v)}>
            Fire-related only
          </button>
          <span className="scanner-meta">{shown.length}{fireOnly && all.length ? ` of ${all.length}` : ''}{isFetching ? ' · live' : ''}</span>
        </div>
      </div>

      <div className="list-scroll">
        {isLoading && <p className="list-empty">Connecting to transcriber…</p>}
        {isError && (
          <p className="list-empty">
            Couldn’t reach the transcriber ({(error as Error).message}). Check it’s running, served over HTTPS, and has CORS enabled for this site.
          </p>
        )}
        {!isLoading && !isError && shown.length === 0 && (
          <p className="list-empty">{fireOnly ? 'No wildfire-related transmissions yet.' : 'No transmissions yet.'}</p>
        )}
        {shown.map((t) => (
          <div key={t.id} className="scanner-row">
            <div className="scanner-row-head">
              <span className="scanner-channel">{t.channel}</span>
              <span className="scanner-time">{relativeTime(t.timestamp)}</span>
            </div>
            <p className="scanner-text">{t.text}</p>
            {t.audioUrl && (
              <a className="scanner-audio" href={t.audioUrl} target="_blank" rel="noreferrer">▶ audio</a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

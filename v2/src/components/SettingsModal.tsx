import { useEffect, useState } from 'react'
import { useTheme } from '../lib/theme'
import { useUnits } from '../lib/units'
import { useNotificationSound, playChime } from '../lib/notificationSound'
import { useDropOff, DROP_OFF_OPTIONS } from '../lib/dropOff'
import { useTranscriber } from '../lib/transcriber'
import { BASEMAPS } from '../lib/basemaps'
import { notificationsSupported, requestNotificationPermission } from '../hooks/usePlaceAlerts'
import { APP_VERSION, CHANGELOG, DATA_SOURCES, FAQ, REPO_URL, TUTORIAL, formatChangelogDate, groupChangelogByDate } from '../content'

export type SettingsSection = 'general' | 'notifications' | 'integrations' | 'tutorial' | 'faq' | 'whatsnew' | 'about'
type Section = SettingsSection

const NAV: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'faq', label: 'FAQ' },
  { id: 'whatsnew', label: "What's new" },
  { id: 'about', label: 'About' },
]

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={`seg ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">{label}</div>
      {children}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  basemapId: string
  onSetBasemap: (id: string) => void
  placeCount: number
  onClearPlaces: () => void
  initialSection?: SettingsSection
}

export function SettingsModal({ open, onClose, basemapId, onSetBasemap, placeCount, onClearPlaces, initialSection }: Props) {
  const [section, setSection] = useState<Section>(initialSection ?? 'general')

  // Jump to the requested section each time the modal opens (e.g. auto-opened to
  // FAQ for new users or What's-new after an update).
  useEffect(() => {
    if (open) setSection(initialSection ?? 'general')
  }, [open, initialSection])
  const { theme, toggle: toggleTheme } = useTheme()
  const { units, toggle: toggleUnits } = useUnits()
  const { soundEnabled, volume, setSoundEnabled, setVolume } = useNotificationSound()
  const { dropOffHours, setDropOffHours } = useDropOff()
  const { url: transcriberUrl, setUrl: setTranscriberUrl } = useTranscriber()
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const setTheme = (t: 'dark' | 'light') => { if (t !== theme) toggleTheme() }
  const setUnits = (u: 'imperial' | 'metric') => { if (u !== units) toggleUnits() }
  const enableNotifs = async () => {
    await requestNotificationPermission()
    setPerm(notificationsSupported() ? Notification.permission : 'unsupported')
  }
  const clearPlaces = () => {
    if (placeCount === 0) return
    if (window.confirm(`Remove all ${placeCount} saved place${placeCount === 1 ? '' : 's'}?`)) onClearPlaces()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="Close settings">✕</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {NAV.map((n) => (
              <button key={n.id} type="button" className={`settings-nav-item ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>{n.label}</button>
            ))}
          </nav>

          <div className="settings-panel">
            {section === 'general' && (
              <>
                <Field label="Theme">
                  <Segmented value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
                </Field>
                <Field label="Distance & area units">
                  <Segmented value={units} onChange={setUnits} options={[{ value: 'imperial', label: 'Imperial (mi · ac)' }, { value: 'metric', label: 'Metric (km · ha)' }]} />
                </Field>
                <Field label="Default basemap">
                  <select className="settings-select" value={basemapId} onChange={(e) => onSetBasemap(e.target.value)}>
                    {BASEMAPS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="Drop off inactive fires">
                  <select className="settings-select" value={dropOffHours} onChange={(e) => setDropOffHours(Number(e.target.value))}>
                    {DROP_OFF_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
                  </select>
                  <p className="settings-hint">Hide active fires whose record hasn’t been updated within this time — no fresh confirmation they’re still burning. Contained and out fires are unaffected; a hidden fire reappears if it updates again.</p>
                </Field>
              </>
            )}

            {section === 'notifications' && (
              <>
                <Field label="Browser notifications">
                  <div className="settings-inline">
                    <span className={`perm-badge ${perm}`}>{perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked' : perm === 'unsupported' ? 'Unsupported' : 'Not set'}</span>
                    {perm === 'default' && <button className="btn-primary" type="button" onClick={enableNotifs}>Enable</button>}
                  </div>
                  <p className="settings-hint">Proximity alerts appear as OS notifications while a tab is open. Alerts when the app is closed need a backend + push service.</p>
                </Field>
                <Field label="Alert sound">
                  <button className={`switch ${soundEnabled ? 'on' : ''}`} type="button" role="switch" aria-checked={soundEnabled} onClick={() => setSoundEnabled(!soundEnabled)}>
                    <span className="switch-knob" /><span className="switch-label">{soundEnabled ? 'On' : 'Off'}</span>
                  </button>
                </Field>
                <Field label={`Volume — ${Math.round(volume * 100)}%`}>
                  <div className="settings-inline">
                    <input type="range" min={0} max={100} value={Math.round(volume * 100)} disabled={!soundEnabled} onChange={(e) => setVolume(Number(e.target.value) / 100)} />
                    <button className="btn-ghost" type="button" onClick={() => playChime(volume)} disabled={!soundEnabled}>Test</button>
                  </div>
                </Field>
              </>
            )}

            {section === 'integrations' && (
              <>
                <Field label="Scanner transcriber URL">
                  <input
                    className="settings-select"
                    type="url"
                    placeholder="https://your-transcriber.example.com"
                    value={transcriberUrl}
                    onChange={(e) => setTranscriberUrl(e.target.value)}
                    aria-label="Transcriber base URL"
                  />
                  <p className="settings-hint">
                    Point this at your own running <a href="https://github.com/Opertum/broadcastify-transcriber" target="_blank" rel="noreferrer">broadcastify-transcriber</a> instance
                    to add a <b>Scanner</b> tab with live, transcribed fire/police radio, filtered to wildfire-related chatter. Leave blank to disable.
                  </p>
                  <p className="settings-hint">
                    Requirements: you run the transcriber yourself (Python + ffmpeg + Whisper); it must be reachable from this page over <b>HTTPS</b> (a plain
                    http:// address is blocked on the deployed HTTPS site — run it behind TLS/a tunnel, or run this app locally), and it must send <b>CORS</b> headers
                    allowing this origin. Note: it streams Broadcastify’s public audio directly, which is a gray area under Broadcastify’s terms — review those before relying on it.
                  </p>
                </Field>
              </>
            )}

            {section === 'tutorial' && (
              <ol className="tutorial">
                {TUTORIAL.map((s, i) => (
                  <li key={s.title}><span className="tut-n">{i + 1}</span><div><b>{s.title}</b><p>{s.body}</p></div></li>
                ))}
              </ol>
            )}

            {section === 'faq' && (
              <div className="faq">
                {FAQ.map((f) => (
                  <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
                ))}
              </div>
            )}

            {section === 'whatsnew' && (
              <div className="changelog">
                {groupChangelogByDate(CHANGELOG).map((group) => (
                  <section key={group.date} className="changelog-date">
                    <h3 className="changelog-date-head">{formatChangelogDate(group.date)}</h3>
                    {group.entries.map((c) => (
                      <div key={c.version} className="changelog-entry">
                        <div className="changelog-version">v{c.version}</div>
                        <ul>{c.items.map((it) => <li key={it}>{it}</li>)}</ul>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}

            {section === 'about' && (
              <>
                <p className="about-version">Wildfire Command <b>v{APP_VERSION}</b></p>
                <p className="settings-hint">A wildfire situational-awareness console. Your places and preferences are stored only in this browser.</p>
                <a className="about-link" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub ↗</a>
                <div className="settings-field-label" style={{ marginTop: 16 }}>Data sources</div>
                <ul className="sources">
                  {DATA_SOURCES.map((d) => (
                    <li key={d.name}><a href={d.url} target="_blank" rel="noreferrer">{d.name}</a><span>{d.note}</span></li>
                  ))}
                </ul>
                <div className="settings-field-label" style={{ marginTop: 16 }}>Reset</div>
                <button className="btn-danger" type="button" onClick={clearPlaces} disabled={placeCount === 0}>
                  Clear saved places{placeCount > 0 ? ` (${placeCount})` : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

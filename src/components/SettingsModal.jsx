import { useEffect, useState } from 'react'
import { MAP_LAYERS } from '../lib/mapLayers'
import { UNITS } from '../lib/units'

function Section({ title, desc, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={`segmented-opt ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onSetTheme,
  units,
  onSetUnits,
  soundOn,
  onToggleSound,
  defaultLayer,
  onSetDefaultLayer,
  notifSettings,
  onSaveNotif,
}) {
  const [channelId, setChannelId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifStatus, setNotifStatus] = useState(null)

  useEffect(() => {
    if (!open) return
    setChannelId(notifSettings.slack_channel_id || '')
    setEnabled(Boolean(notifSettings.enabled))
    setNotifStatus(null)
  }, [open, notifSettings])

  if (!open) return null

  const saveNotif = async (e) => {
    e.preventDefault()
    setNotifStatus(null)
    const trimmed = channelId.trim().toUpperCase()
    if (enabled && !/^[CGD][A-Z0-9]{7,}$/.test(trimmed)) {
      setNotifStatus({ ok: false, msg: 'Enter a valid Slack channel ID (e.g. C0BFY7Q8PC0) to enable notifications.' })
      return
    }
    setSavingNotif(true)
    const ok = await onSaveNotif({ slack_channel_id: trimmed || null, enabled })
    setSavingNotif(false)
    setNotifStatus(ok ? { ok: true, msg: 'Notification settings saved.' } : { ok: false, msg: 'Could not save settings.' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Settings</h2>
            <p className="modal-sub">Personalize the console and configure notifications</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <Section title="Appearance" desc="Switch between dark and light interface themes.">
            <Segmented
              options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
              value={theme}
              onChange={onSetTheme}
            />
          </Section>

          <Section title="Notification sound" desc="Play a chime for new alerts and incident updates.">
            <button
              type="button"
              className={`switch ${soundOn ? 'on' : ''}`}
              onClick={onToggleSound}
              role="switch"
              aria-checked={soundOn}
            >
              <span className="switch-knob" />
              <span className="switch-label">{soundOn ? 'On' : 'Off'}</span>
            </button>
          </Section>

          <Section title="Measurement system" desc="Units used across the map, list, and incident details.">
            <Segmented
              options={[{ value: UNITS.imperial, label: 'Imperial (mi · ac)' }, { value: UNITS.metric, label: 'Metric (km · ha)' }]}
              value={units}
              onChange={onSetUnits}
            />
          </Section>

          <Section title="Default map layer" desc="Base map shown when the console first loads.">
            <select
              className="form-input settings-select"
              value={defaultLayer}
              onChange={(e) => onSetDefaultLayer(e.target.value)}
            >
              {MAP_LAYERS.map((l) => (
                <option key={l.id} value={l.id}>{l.name} — {l.description}</option>
              ))}
            </select>
          </Section>

          <Section title="External notifications" desc="Relay updates for monitored incidents to a Slack channel via the Slack app.">
            <form onSubmit={saveNotif} className="notif-form">
              <button
                type="button"
                className={`switch ${enabled ? 'on' : ''}`}
                onClick={() => setEnabled((v) => !v)}
                role="switch"
                aria-checked={enabled}
              >
                <span className="switch-knob" />
                <span className="switch-label">{enabled ? 'Sending enabled' : 'Sending disabled'}</span>
              </button>
              <label className="form-label">
                Slack channel ID
                <input
                  type="text"
                  className="form-input"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="C0BFY7Q8PC0"
                />
              </label>
              <p className="share-hint">
                Copy the channel ID from the Slack channel's URL, and invite the notification bot to that channel.
                When enabled, every new update on an incident you are monitoring is posted there.
              </p>
              {notifStatus && <div className={`share-status ${notifStatus.ok ? 'ok' : 'err'}`}>{notifStatus.msg}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={savingNotif}>
                  {savingNotif ? 'Saving…' : 'Save notifications'}
                </button>
              </div>
            </form>
          </Section>
        </div>
      </div>
    </div>
  )
}

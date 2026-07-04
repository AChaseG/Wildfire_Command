let ctx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(audio, freq, startAt, duration, peak) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

// Bright two-note rising chime for new alerts.
export function playAlertChime() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(audio, 880, t, 0.18, 0.18)
  tone(audio, 1174.66, t + 0.14, 0.28, 0.18)
}

// Soft single tone for incident updates.
export function playUpdateChime() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(audio, 587.33, t, 0.32, 0.12)
}

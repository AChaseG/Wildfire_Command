import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

let audioCtx: AudioContext | null = null

// A short two-note chime via Web Audio (no asset). Volume is 0..1. Browsers
// gate audio until a user gesture, so this is reliable after the user has
// interacted (e.g. pressed "Test") and best-effort otherwise.
export function playChime(volume: number): void {
  if (volume <= 0 || typeof window === 'undefined') return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  try {
    audioCtx = audioCtx ?? new Ctor()
    void audioCtx.resume()
    const now = audioCtx.currentTime
    const gain = audioCtx.createGain()
    gain.connect(audioCtx.destination)
    gain.gain.setValueAtTime(Math.min(1, volume) * 0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.setValueAtTime(1175, now + 0.11)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.36)
  } catch {
    // Audio unavailable; ignore.
  }
}

interface SoundState {
  soundEnabled: boolean
  volume: number
  setSoundEnabled: (v: boolean) => void
  setVolume: (v: number) => void
}

const SoundContext = createContext<SoundState>({
  soundEnabled: true, volume: 0.5, setSoundEnabled: () => {}, setVolume: () => {},
})

export function NotificationSoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('wc-sound') !== 'off')
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem('wc-volume')
    const v = stored === null ? NaN : Number(stored)
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.5
  })

  useEffect(() => { localStorage.setItem('wc-sound', soundEnabled ? 'on' : 'off') }, [soundEnabled])
  useEffect(() => { localStorage.setItem('wc-volume', String(volume)) }, [volume])

  return (
    <SoundContext.Provider value={{ soundEnabled, volume, setSoundEnabled, setVolume }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useNotificationSound() {
  return useContext(SoundContext)
}

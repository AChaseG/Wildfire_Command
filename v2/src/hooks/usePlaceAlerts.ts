import { useEffect, useRef } from 'react'
import { detectProximities, proximityKey, type SavedPlace, kmToMiles, type Fire } from '../domain'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// Fires an OS notification when an active fire first appears within an
// alert-enabled place's radius, de-duped so each (place, fire) pair announces
// once. Requires granted Notification permission. Works while a tab is open;
// true push when the app is closed needs a backend + push service.
export function usePlaceAlerts(fires: Fire[], places: SavedPlace[]) {
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!notificationsSupported() || Notification.permission !== 'granted') return

    const hits = detectProximities(fires, places)
    const currentKeys = new Set(hits.map(proximityKey))

    for (const hit of hits) {
      const key = proximityKey(hit)
      if (notifiedRef.current.has(key)) continue
      notifiedRef.current.add(key)
      const mi = Math.round(kmToMiles(hit.distanceKm))
      try {
        new Notification(`🔥 ${hit.fire.name} near ${hit.place.name}`, {
          body: `${mi} mi away · ${hit.fire.containmentPct}% contained · ${hit.fire.acres.toLocaleString()} acres`,
          tag: key,
        })
      } catch {
        // Notification construction can throw on some platforms; ignore.
      }
    }

    // Forget pairs that are no longer in range, so a fire that leaves and later
    // re-enters the radius alerts again.
    for (const key of notifiedRef.current) {
      if (!currentKeys.has(key)) notifiedRef.current.delete(key)
    }
  }, [fires, places])
}

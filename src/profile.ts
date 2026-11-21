import { usAqi } from './aqi'
import type { ForecastHour } from './forecast'
import { hh } from './time'

// Onboarding choice "Komu prilagodimo nasvete?" — optional, stays on the device.
export const PROFILES = [
  { key: 'starejsi', label: 'Starejši', who: 'starejše', sensitive: true },
  { key: 'nosecnost', label: 'Nosečnost', who: 'nosečnice', sensitive: true },
  { key: 'astma', label: 'Astma/pljuča', who: 'občutljiva pljuča', sensitive: true },
  { key: 'otroci', label: 'Otroci', who: 'otroke', sensitive: true },
  { key: 'nihce', label: 'Nihče posebej', who: 'vse', sensitive: false },
] as const

export type ProfileKey = (typeof PROFILES)[number]['key']
export const profileOf = (k: ProfileKey) => PROFILES.find((p) => p.key === k) ?? PROFILES[4]

/** AQI above which we advise caution: "Zmerno" for sensitive groups, "Slabo" for everyone else. */
export const thresholdAqi = (k: ProfileKey) => (profileOf(k).sensitive ? 50 : 100)

/** Two-line advice for the hero card, e.g. "Za občutljiva pljuča:\nkrajši sprehod do 18h." */
export function adviceFor(pm25: number, hours: ForecastHour[], k: ProfileKey) {
  const p = profileOf(k)
  const limit = thresholdAqi(k)
  const head = `Za ${p.who}:`
  if (usAqi(pm25) > limit) return `${head}\nraje ostani v zaprtem.`
  const bad = hours.find((h) => usAqi(h.value) > limit)
  if (bad) return `${head}\nkrajši sprehod do ${Number(hh(bad.time))}h.`
  return `${head}\nzrak je primeren za sprehod.`
}

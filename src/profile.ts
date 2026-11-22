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

/** The groups chosen at onboarding, cleaned: "nihče posebej" alone, otherwise the sensitive ones in the fixed order */
export function cleanProfiles(keys: ProfileKey[]): ProfileKey[] {
  const chosen = PROFILES.filter((p) => p.sensitive && keys.includes(p.key)).map((p) => p.key)
  return chosen.length ? chosen : ['nihce']
}

/** The one key for places that take a single profile (breathing pace, alert threshold): the most sensitive chosen */
export const primaryProfile = (keys: ProfileKey[]): ProfileKey => cleanProfiles(keys)[0]

/** One sentence of advice for a group, e.g. "Krajši sprehod do 18h." (the card names the group above it) */
export function adviceFor(pm25: number, hours: ForecastHour[], k: ProfileKey) {
  const limit = thresholdAqi(k)
  if (usAqi(pm25) > limit) return 'Raje ostani v zaprtem.'
  const bad = hours.find((h) => usAqi(h.value) > limit)
  if (bad) return `Krajši sprehod do ${Number(hh(bad.time))}h.`
  return 'Zrak je primeren za sprehod.'
}

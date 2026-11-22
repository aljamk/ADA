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

const hourOf = (h: ForecastHour) => Number(hh(h.time))
const inHours = (n: number) => (n === 1 ? 'čez eno uro' : n === 2 ? 'čez dve uri' : `čez ${n} ur`)

/**
 * One encouraging sentence for a group (the card names the group above it): when to go out, never "stay in".
 * `hours` are the next 24 hours of the model; hours[0] is the coming hour.
 */
export function adviceFor(pm25: number, hours: ForecastHour[], k: ProfileKey) {
  const limit = thresholdAqi(k)
  const ok = (h: ForecastHour) => usAqi(h.value) <= limit
  if (usAqi(pm25) <= limit) {
    const bad = hours.findIndex((h) => !ok(h))
    if (bad < 0) return 'Zrak je primeren za sprehod in po modelu ostane tak ves dan.'
    if (bad === 0) return 'Zrak je zdaj še primeren za sprehod; pojdi ven kar zdaj.'
    return `Zrak je primeren za sprehod. Pojdi ven do ${hourOf(hours[bad])}h.`
  }
  // Relief within the next six hours: say when
  const relief = hours.slice(0, 6).findIndex(ok)
  if (relief >= 0) return `Na sprehod se odpravi ${inHours(relief + 1)}, okoli ${hourOf(hours[relief])}h, ko se zrak zbistri.`
  // Otherwise the cleanest daytime hour (7–20h) of the next 12: a time to look forward to, not a closed door
  const day = hours.slice(0, 12).map((h, i) => ({ h, i })).filter(({ h }) => hourOf(h) >= 7 && hourOf(h) <= 20)
  if (!day.length) return 'Zrak je zdaj slabši; za sprehod počakaj na jutro in preveri znova.'
  const low = day.reduce((b, x) => (x.h.value < b.h.value ? x : b))
  return `Za sprehod izberi čas okoli ${hourOf(low.h)}h (${inHours(low.i + 1)}), ko bo zrak danes najčistejši.`
}

/** When to air the home: the cleanest three-hour window of the next 12 hours, e.g. "Prezrači okoli 13h." */
export function airingText(hours: ForecastHour[]) {
  const h12 = hours.slice(0, 12)
  if (h12.length < 3) return null
  const avg = (i: number) => (h12[i].value + h12[i + 1].value + h12[i + 2].value) / 3
  let best = 0
  for (let i = 1; i + 2 < h12.length; i++) if (avg(i) < avg(best)) best = i
  const start = hourOf(h12[best])
  if (best === 0) return 'Prezračevanje: zdaj je dober čas, zrak bo kasneje slabši.'
  return `Prezračevanje: najbolje ${inHours(best + 1)}, med ${start}h in ${(start + 3) % 24}h.`
}

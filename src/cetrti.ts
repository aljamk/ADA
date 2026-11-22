// The 17 četrtne skupnosti of Ljubljana (public/data/cetrti.json, from the ARSOhack package).
import { distanceKm, type Reading } from './arso'

export interface Cetrt {
  ime: string
  rel: number // long-term exposure index relative to the city average (1.0), from cs_kazalniki
  lat: number
  lon: number
}

let cache: Promise<Cetrt[]> | null = null
export function loadCetrti() {
  cache ??= fetch('/data/cetrti.json').then((r) => r.json() as Promise<Cetrt[]>).catch(() => [])
  return cache
}

const closest = <T extends { lat: number; lon: number }>(items: T[], lat: number, lon: number) =>
  items.reduce<T | null>((best, c) => (!best || distanceKm(c.lat, c.lon, lat, lon) < distanceKm(best.lat, best.lon, lat, lon) ? c : best), null)

/** The četrt each Ljubljana station stands in (the nearest centroid would put Vič into Trnovo) */
const STATION_CETRT: Record<string, string> = { E403: 'Bežigrad', E405: 'Šiška', E404: 'Vič' }

/** The četrt of a station: by the fixed table for the Ljubljana stations, otherwise the nearest centre */
export const cetrtOfStation = (cetrti: Cetrt[], r: Reading) => STATION_CETRT[r.code] ?? closest(cetrti, r.lat, r.lon)?.ime ?? null

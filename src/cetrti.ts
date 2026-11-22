// The 17 četrtne skupnosti of Ljubljana (public/data/cetrti.json, from the ARSOhack package).
import { distanceKm, inBasin, type Reading } from './arso'

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

/** The četrt whose centre is nearest to a station */
export const cetrtOfStation = (cetrti: Cetrt[], r: Reading) => closest(cetrti, r.lat, r.lon)?.ime ?? null

/** The basin station that measures PM2.5 nearest to a četrt */
export const stationOfCetrt = (readings: Reading[], c: Cetrt) => closest(readings.filter((r) => inBasin(r) && r.pm25 != null), c.lat, c.lon)?.code ?? null

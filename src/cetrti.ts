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

/** The četrt whose centre is nearest to a point */
export const nearestCetrt = (cetrti: Cetrt[], lat: number, lon: number) => closest(cetrti, lat, lon)

/**
 * The source that stands for a četrt: the nearest official ARSO station, unless it is more than
 * 3 km away and a citizen sensor is less than half that distance. Official measurements are preferred;
 * a sensor only wins when it is clearly closer to home.
 */
export function sourceFor(c: Cetrt, readings: Reading[]) {
  const usable = readings.filter((r) => inBasin(r) && r.pm25 != null)
  const arso = closest(usable.filter((r) => r.kind !== 'OCENA'), c.lat, c.lon)
  const sensor = closest(usable.filter((r) => r.kind === 'OCENA'), c.lat, c.lon)
  if (!arso) return sensor
  const da = distanceKm(arso.lat, arso.lon, c.lat, c.lon)
  if (sensor && da > 3 && distanceKm(sensor.lat, sensor.lon, c.lat, c.lon) < da / 2) return sensor
  return arso
}

/** The nearest official ARSO station to a četrt (the widget reads ARSO itself) */
export const arsoFor = (c: Cetrt, readings: Reading[]) => closest(readings.filter((r) => r.kind !== 'OCENA' && inBasin(r)), c.lat, c.lon)

/**
 * Current PM2.5 ESTIMATE for a četrt: the official stations interpolated to the četrt (inverse distance, km)
 * and scaled by its long-term exposure index. Null without measurements.
 */
export function estimateFor(c: Cetrt, stations: Reading[]) {
  let num = 0
  let den = 0
  for (const s of stations) {
    if (s.pm25 == null) continue
    const dx = (s.lon - c.lon) * 111 * Math.cos((c.lat * Math.PI) / 180)
    const dy = (s.lat - c.lat) * 111
    const w = 1 / Math.max(1, dx * dx + dy * dy)
    num += w * s.pm25
    den += w
  }
  return den ? Math.round((num / den) * c.rel) : null
}

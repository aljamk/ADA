// Citizen sensors around Ljubljana from Sensor.Community (sensor.community, ODbL; CORS open).
// They are NOT official measurements: uncalibrated low-cost particle sensors, labelled OCENA everywhere.
import type { Reading } from './arso'
import { distanceKm, LJ } from './arso'
import { loadCetrti } from './cetrti'

const URL = `https://data.sensor.community/airrohr/v1/filter/area=${LJ.lat},${LJ.lon},10&type=SDS011,SPS30,PMS5003,PMS7003`

interface Entry {
  sensor: { id: number }
  location: { latitude: string; longitude: string }
  timestamp: string // "2026-11-22 02:05:43" UTC
  sensordatavalues: { value_type: string; value: string }[]
}

/** "2026-11-22 02:05:43" UTC → local "2026-11-22 03:00" (same format as ARSO, start of the hour) */
function localHour(utc: string) {
  const d = new Date(utc.replace(' ', 'T') + 'Z')
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`
}

/** Citizen sensors with a PM2.5 value in the last readings, one per location, named after their četrt */
export async function fetchCitizen(): Promise<Reading[]> {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Sensor.Community ${res.status}`)
  const data = (await res.json()) as Entry[]
  const cetrti = await loadCetrti()
  const byPlace = new Map<string, Reading>()
  for (const e of data) {
    const p2 = e.sensordatavalues.find((v) => v.value_type === 'P2')?.value
    const p1 = e.sensordatavalues.find((v) => v.value_type === 'P1')?.value
    if (p2 == null) continue
    // A faulty or wet sensor reports hundreds; such values are not shown at all
    if (!(Number(p2) >= 0 && Number(p2) <= 250)) continue
    const lat = Number(e.location.latitude)
    const lon = Number(e.location.longitude)
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
    if (byPlace.has(key)) continue
    const cetrt = cetrti.reduce<{ ime: string; d: number } | null>((best, c) => {
      const d = distanceKm(c.lat, c.lon, lat, lon)
      return !best || d < best.d ? { ime: c.ime, d } : best
    }, null)
    byPlace.set(key, {
      code: `SC${e.sensor.id}`,
      name: `Občanski senzor · ${cetrt?.ime ?? 'Ljubljana'}`,
      from: localHour(e.timestamp),
      lat,
      lon,
      pm25: Math.round(Number(p2)),
      pm10: p1 != null ? Math.round(Number(p1)) : null,
      kind: 'OCENA',
    })
  }
  const list = [...byPlace.values()].sort((a, b) => a.name.localeCompare(b.name, 'sl'))
  // Two sensors in the same četrt get a number
  const counts = new Map<string, number>()
  for (const r of list) counts.set(r.name, (counts.get(r.name) ?? 0) + 1)
  const seen = new Map<string, number>()
  for (const r of list) {
    if ((counts.get(r.name) ?? 0) > 1) {
      const n = (seen.get(r.name) ?? 0) + 1
      seen.set(r.name, n)
      r.name = `${r.name} ${n}`
    }
  }
  return list
}

export const isCitizen = (r: Reading) => r.kind === 'OCENA'

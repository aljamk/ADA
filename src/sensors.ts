// Citizen sensors of the Ljubljana basin. The list of devices and their calibration come from the ADA Hack
// data package (public/data/senzorji.json, built by scripts/build_senzorji.py); the live value comes from the
// Sensor.Community API the package names (last 5 minutes, bbox of the basin). They are NOT official
// measurements: low-cost particle sensors, labelled OCENA everywhere, calibrated to the nearest ARSO station
// with the package's linear coefficients (ARSO = a * sensor + b).
import { ARSO_NAMES, type Reading } from './arso'

const LIVE = 'https://data.sensor.community/airrohr/v1/filter/box=45.95,14.35,46.15,14.70'

export interface Senzor {
  vir: 'SC' | 'PA' // Sensor.Community (live) or PurpleAir (listed only: its API needs a key)
  id: number
  ime: string
  lat: number
  lon: number
  vlaga?: number | null
  zadnji_dan?: string
  ref?: string // ARSO station the calibration is against
  km?: number
  a?: number
  b?: number
  r?: number
  n?: number
  zanesljiv?: boolean
}

let cache: Promise<Senzor[]> | null = null
export function loadSenzorji() {
  cache ??= fetch('/data/senzorji.json').then((r) => r.json() as Promise<Senzor[]>).catch(() => [])
  return cache
}

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

export const codeOf = (s: Senzor) => `${s.vir}${s.id}`

/** Every device of the package as a Reading; the Sensor.Community ones carry their latest live value, or null */
export async function fetchCitizen(): Promise<Reading[]> {
  const senzorji = await loadSenzorji()
  let live: Entry[] = []
  try {
    const res = await fetch(LIVE)
    if (res.ok) live = (await res.json()) as Entry[]
  } catch {
    // offline: the devices are still listed, without a value
  }
  return senzorji.map((s) => {
    const base: Reading = {
      code: codeOf(s),
      name: `Občanski senzor · ${s.ime}`,
      from: '',
      lat: s.lat,
      lon: s.lon,
      pm25: null,
      pm10: null,
      kind: 'OCENA',
      vir: s.vir,
      ref: s.ref,
      umerjen: false,
    }
    if (s.vir !== 'SC') return base
    // The newest packet of this device with a PM2.5 value
    const e = live
      .filter((x) => x.sensor.id === s.id && x.sensordatavalues.some((v) => v.value_type === 'P2'))
      .sort((x, y) => (x.timestamp < y.timestamp ? 1 : -1))[0]
    if (!e) return base
    const raw = Number(e.sensordatavalues.find((v) => v.value_type === 'P2')?.value)
    const p1 = e.sensordatavalues.find((v) => v.value_type === 'P1')?.value
    // A faulty or wet sensor reports hundreds (the package flags such hours as "okvara"); no value is shown
    if (!(raw >= 0 && raw <= 250)) return base
    const umerjen = !!(s.zanesljiv && s.a != null && s.b != null)
    const pm25 = umerjen ? Math.max(0, s.a! * raw + s.b!) : raw
    return {
      ...base,
      from: localHour(e.timestamp),
      pm25: Math.round(pm25),
      pm10: p1 != null ? Math.round(Number(p1)) : null,
      raw: Math.round(raw),
      umerjen,
    }
  })
}

export const isCitizen = (r: Reading) => r.kind === 'OCENA'
/** "umerjen po ARSO Vič" or "neumerjen": the words under every citizen value */
export const calibrationNote = (r: Reading) => (r.umerjen && r.ref ? `umerjen po ARSO ${ARSO_NAMES[r.ref] ?? r.ref}` : 'neumerjen')

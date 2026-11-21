// ARSO live feed: last hour for all stations in Slovenia (CORS open, refreshes ~45 min past the hour).
const ARSO_URL = 'https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml'

export interface Reading {
  code: string
  name: string
  from: string // "2026-11-21 16:00" (local time, start of the hourly average)
  pm25: number | null
  pm10: number | null
}

function num(el: Element, tag: string): number | null {
  const t = el.getElementsByTagName(tag)[0]?.textContent?.trim()
  if (!t) return null
  const v = Number(t.replace('<', ''))
  return Number.isFinite(v) ? v : null
}

export async function fetchArso(): Promise<Reading[]> {
  const res = await fetch(ARSO_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ARSO ${res.status}`)
  const xml = new DOMParser().parseFromString(await res.text(), 'application/xml')
  return Array.from(xml.getElementsByTagName('postaja')).map((p) => ({
    code: p.getAttribute('sifra') ?? '',
    name: p.getElementsByTagName('merilno_mesto')[0]?.textContent ?? '?',
    from: p.getElementsByTagName('datum_od')[0]?.textContent ?? '',
    pm25: num(p, 'pm2.5'),
    pm10: num(p, 'pm10'),
  }))
}

// PM2.5 levels (EEA European Air Quality Index bands, µg/m³). TODO: confirm with ARSO.
export const LEVELS = [
  { min: 0, label: 'Dober', color: '#50F0E6' },
  { min: 5, label: 'Sprejemljiv', color: '#50CCAA' },
  { min: 15, label: 'Zmeren', color: '#F0E641' },
  { min: 50, label: 'Slab', color: '#FF5050' },
  { min: 90, label: 'Zelo slab', color: '#960032' },
  { min: 140, label: 'Izjemno slab', color: '#7D2181' },
]

export function levelOf(v: number) {
  return [...LEVELS].reverse().find((l) => v >= l.min)!
}

// Game buckets for "Napovej jutri"
export const BUCKETS = [
  { key: 'dober', label: 'Dober', hint: '< 15', test: (v: number) => v < 15 },
  { key: 'zmeren', label: 'Zmeren', hint: '15–50', test: (v: number) => v >= 15 && v < 50 },
  { key: 'slab', label: 'Slab', hint: '≥ 50', test: (v: number) => v >= 50 },
] as const

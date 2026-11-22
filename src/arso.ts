// ARSO live feed: last hour for all stations in Slovenia (CORS open, refreshes ~45 min past the hour).
const ARSO_URL = 'https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml'

export interface Reading {
  code: string
  name: string
  from: string // "2026-11-21 16:00" (local time, start of the hourly average)
  lat: number
  lon: number
  pm25: number | null
  pm10: number | null
  /** MERITEV = official ARSO station (default), OCENA = uncalibrated citizen sensor */
  kind?: 'MERITEV' | 'OCENA'
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
    lat: Number(p.getAttribute('wgs84_sirina')),
    lon: Number(p.getAttribute('wgs84_dolzina')),
    pm25: num(p, 'pm2.5'),
    pm10: num(p, 'pm10'),
  }))
}

/** "LJ Bežigrad" -> "Bežigrad" for compact UI */
export const shortName = (name: string) => name.replace(/^LJ /, '')

// ARSO uses city abbreviations in station names; expand them so "Maribor" finds "MB Titova".
const CITY: Record<string, string> = {
  LJ: 'Ljubljana', MB: 'Maribor', CE: 'Celje', MS: 'Murska Sobota', NG: 'Nova Gorica', IB: 'Ilirska Bistrica',
}
export const searchText = (r: Reading) => `${r.name} ${CITY[r.name.split(' ')[0]] ?? ''}`.toLowerCase()

/** Nearest station (equirectangular distance is plenty for Slovenia) */
// The challenge is about Ljubljana: the app offers only the stations of the Ljubljana basin
export const LJ = { lat: 46.0569, lon: 14.5058 }
export const LJ_RADIUS_KM = 12 // the three Ljubljana stations; Grosuplje (~17 km) and Kranj (~23 km) are out
export const inBasin = (r: Reading) => distanceKm(r.lat, r.lon, LJ.lat, LJ.lon) <= LJ_RADIUS_KM

export function nearest(readings: Reading[], lat: number, lon: number) {
  const k = Math.cos((lat * Math.PI) / 180)
  const d = (r: Reading) => (r.lat - lat) ** 2 + ((r.lon - lon) * k) ** 2
  return readings.reduce((a, b) => (d(b) < d(a) ? b : a))
}

/** Distance in km (for "Najbližji senzor: Bežigrad, 1,8 km") */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const k = Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot(lat2 - lat1, (lon2 - lon1) * k) * 111.2
}

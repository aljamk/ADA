import { dateStr } from './time'

// "Ugani zrak" daily challenge: 5 rounds, the same for everyone on a given day (seeded by date).
//
// Truth source, in order:
//  1. public/data/ugani-krogi.json — real ARSO hourly PM2.5 (winters 2020–2026) from the hackathon
//     data package (github.com/vidacex/ARSOhack), built with scripts/build_data.py (label: MERITEV).
//     Vir: ARSO. Hourly values are not formally validated.
//  2. Fallback if that file is missing: CAMS model for that past hour via Open-Meteo (label: MODEL).

export interface Place {
  name: string
  lat: number
  lon: number
  station: string // nearest official station, shown as "Najbližji senzor"
  photo?: string
}

export const PLACES: Place[] = [
  { name: 'Tivoli', lat: 46.0544, lon: 14.4958, station: 'Bežigrad', photo: '/figma/tivoli.png' },
  { name: 'Bežigrad', lat: 46.0655, lon: 14.5127, station: 'Bežigrad' },
  { name: 'Center', lat: 46.0514, lon: 14.5060, station: 'Bežigrad' },
  { name: 'Šiška', lat: 46.0721, lon: 14.4871, station: 'Celovška' },
  { name: 'Vič', lat: 46.0375, lon: 14.4893, station: 'Vič' },
]

export interface Round {
  place: Place
  time: string // "2025-01-14 21:00"
  value?: number // PM2.5 µg/m³, filled by loadRound
  source?: 'MERITEV' | 'MODEL'
}

interface PackagedRound {
  place: string
  time: string
  pm25: number
  station: string
}

// Small deterministic PRNG so every player gets the same rounds on the same day
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const HOURS = [8, 12, 18, 21, 22]
const pad = (n: number) => String(n).padStart(2, '0')

/** Five rounds for today: winter days (Nov–Feb) from 2023 to last winter, evening-heavy hours. */
export function dailyRounds(day = dateStr(new Date())): Round[] {
  const r = rng(Number(day.replace(/-/g, '')))
  const thisYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => {
    const winterStart = 2023 + Math.floor(r() * (thisYear - 2023)) // Nov of this year .. Feb next year
    const month = [11, 12, 1, 2][Math.floor(r() * 4)]
    const year = month >= 11 ? winterStart : winterStart + 1
    const d = 1 + Math.floor(r() * 28)
    const place = PLACES[i === 0 ? 0 : Math.floor(r() * PLACES.length)]
    return { place, time: `${year}-${pad(month)}-${pad(d)} ${pad(HOURS[Math.floor(r() * HOURS.length)])}:00` }
  })
}

let packaged: Promise<PackagedRound[] | null> | null = null
const loadPackaged = () =>
  (packaged ??= fetch('/data/ugani-krogi.json')
    .then((r) => (r.ok ? (r.json() as Promise<PackagedRound[]>) : null))
    .catch(() => null))

/** Fill in the true value for a round (measurement if packaged, otherwise model). */
export async function loadRound(round: Round): Promise<Round> {
  const pkg = await loadPackaged()
  if (pkg?.length) {
    // Use a packaged measurement for the same place, picked deterministically from the round's time
    const forPlace = pkg.filter((p) => p.place === round.place.name)
    const list = forPlace.length ? forPlace : pkg
    const pick = list[Number(round.time.replace(/\D/g, '')) % list.length]
    return { ...round, time: pick.time, value: pick.pm25, source: 'MERITEV', place: { ...round.place, station: pick.station } }
  }
  const date = round.time.slice(0, 10)
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${round.place.lat}&longitude=${round.place.lon}&hourly=pm2_5` +
    `&start_date=${date}&end_date=${date}&timezone=Europe%2FLjubljana`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = (await res.json()) as { hourly: { time: string[]; pm2_5: (number | null)[] } }
  const i = data.hourly.time.indexOf(round.time.replace(' ', 'T'))
  const v = data.hourly.pm2_5[i]
  if (v == null) throw new Error('Ni podatka za to uro')
  return { ...round, value: Math.round(v), source: 'MODEL' }
}

/** "2025-01-14 21:00" -> "14. 1. 2025 · 21:00" */
export const roundDate = (t: string) =>
  `${Number(t.slice(8, 10))}. ${Number(t.slice(5, 7))}. ${t.slice(0, 4)} · ${t.slice(11, 16)}`

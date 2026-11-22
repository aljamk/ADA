// Two scales, both from the Figma design:
// 1. AQI on the "Zdaj" screen: US EPA AQI computed from the hourly PM2.5 value (2024 breakpoints).
//    ARSO does not publish an AQI number; this is our conversion and is labelled as such.
// 2. "Učna lestvica" in the game: a simple µg/m³ learning scale, explicitly not health limits.

const BREAKPOINTS: [number, number, number, number][] = [
  [0, 9, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
]

export function usAqi(pm25: number) {
  const c = Math.floor(pm25 * 10) / 10
  for (const [cl, ch, il, ih] of BREAKPOINTS) if (c <= ch) return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il)
  return 500
}

export interface Level {
  key: 'dobro' | 'zmerno' | 'slabo' | 'zeloslabo' | 'nevarno'
  label: string
  /** The same word agreeing with "kakovost" (feminine): Dobra, Zmerna, … */
  labelF: string
  symbol: string // shape so the level is never colour-only
  color: string
}

export const LEVELS: Level[] = [
  { key: 'dobro', label: 'Dobro', labelF: 'Dobra', symbol: '○', color: 'var(--dobro)' },
  { key: 'zmerno', label: 'Zmerno', labelF: 'Zmerna', symbol: '−', color: 'var(--zmerno)' },
  { key: 'slabo', label: 'Slabo', labelF: 'Slaba', symbol: '△', color: 'var(--slabo)' },
  { key: 'zeloslabo', label: 'Zelo slabo', labelF: 'Zelo slaba', symbol: '▲', color: 'var(--zeloslabo)' },
  { key: 'nevarno', label: 'Nevarno', labelF: 'Nevarna', symbol: '■', color: 'var(--nevarno)' },
]

/** Level from AQI: 0–50, 51–100, 101–150, 151–200, >200 */
export function levelOfAqi(aqi: number) {
  return LEVELS[aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : aqi <= 200 ? 3 : 4]
}
export const levelOfPm = (pm25: number) => levelOfAqi(usAqi(pm25))

/** Game learning scale in µg/m³ (0–100): 0–15, 15–25, 25–50, 50–75, 75+ */
export const LEARN = [
  { from: 0, to: 15, level: LEVELS[0] },
  { from: 15, to: 25, level: LEVELS[1] },
  { from: 25, to: 50, level: LEVELS[2] },
  { from: 50, to: 75, level: LEVELS[3] },
  { from: 75, to: 100, level: LEVELS[4] },
]
export const learnLevel = (pm25: number) => (LEARN.find((s) => pm25 < s.to) ?? LEARN[4]).level

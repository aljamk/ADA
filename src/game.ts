import { BUCKETS } from './arso'
import { dateStr, isoWeek } from './time'

export type BucketKey = (typeof BUCKETS)[number]['key']

export interface Bet {
  station: string
  stationName?: string
  target: string // "YYYY-MM-DD 08:00", resolved by the ARSO reading for that hour
  bucket: BucketKey
  model?: number // calibrated model forecast for the target hour, hidden until resolved
  actual?: number
  points?: number
  modelCorrect?: boolean
}

export const bucketOf = (v: number): BucketKey => BUCKETS.find((b) => b.test(v))!.key
export const bucketLabel = (k: BucketKey) => BUCKETS.find((b) => b.key === k)!.label

export function resolveBet(b: Bet, actual: number): Bet {
  const correct = bucketOf(actual) === b.bucket
  return {
    ...b,
    actual,
    points: correct ? 100 : 0,
    modelCorrect: b.model != null ? bucketOf(b.model) === bucketOf(actual) : undefined,
  }
}

/** Days in a row with a placed bet, counting back from the newest target day */
export function streak(bets: Bet[]) {
  const days = new Set(bets.map((b) => b.target.slice(0, 10)))
  let d = new Date(Date.now() + 86400000)
  if (!days.has(dateStr(d))) d = new Date()
  let n = 0
  while (days.has(dateStr(d))) {
    n++
    d = new Date(d.getTime() - 86400000)
  }
  return n
}

export function shareText(bets: Bet[]) {
  const resolved = bets.filter((b) => b.points !== undefined).slice(-7)
  const squares = resolved.map((b) => (b.points ? '🟩' : '🟥')).join('')
  const me = resolved.filter((b) => b.points).length
  const model = resolved.filter((b) => b.modelCorrect).length
  return `Zrak, ki ga dihamo · Napovej jutri\n${squares || '⬜'}\nJaz ${me} : ${model} model`
}

const ADJ = ['Megleni', 'Sveži', 'Hitri', 'Modri', 'Tihi', 'Budni', 'Zeleni', 'Vetrovni']
const ANIMAL = ['Bober', 'Zmaj', 'Polh', 'Jež', 'Sokol', 'Lisjak', 'Medved', 'Ris']
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
export const randomNickname = () => `${pick(ADJ)} ${pick(ANIMAL)} #${Math.floor(100 + Math.random() * 900)}`

// The 17 četrtne skupnosti of MOL
export const CETRTI = [
  'Bežigrad', 'Center', 'Črnuče', 'Dravlje', 'Golovec', 'Jarše', 'Moste', 'Polje', 'Posavje',
  'Rožnik', 'Rudnik', 'Sostro', 'Šentvid', 'Šiška', 'Šmarna gora', 'Trnovo', 'Vič',
]

/**
 * DEMO league: there is no server yet, so other četrti get a stable pseudo-random weekly score.
 * Replace with a real leaderboard API (anonymous device ID + četrt) after the hackathon.
 */
export function demoLeague(myCetrt: string, myWeekPoints: number) {
  const week = isoWeek()
  return CETRTI.map((c) => {
    let h = week * 31
    for (const ch of c) h = (h * 33 + ch.charCodeAt(0)) % 100003
    const base = 400 + (h % 1100)
    return { cetrt: c, points: base + (c === myCetrt ? myWeekPoints : 0) }
  }).sort((a, b) => b.points - a.points)
}

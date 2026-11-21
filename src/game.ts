import { learnLevel } from './aqi'
import { dateStr, isoWeek } from './time'

export interface RoundResult {
  place: string
  time: string
  guess: number
  actual: number
  source: 'MERITEV' | 'MODEL'
  station: string
  points: number
  accuracy: number
  streakBonus: number
}

/** Everything the game stores, keyed by day ("2026-11-21"). */
export type GameLog = Record<string, RoundResult[]>

/** Accuracy points: 250 for a perfect guess, minus 6.5 per µg/m³ off. */
export const accuracyPoints = (diff: number) => Math.max(0, Math.round(250 - 6.5 * diff))

/** Streak bonus per round: 6 points per day in a row, max 60. */
export const streakBonus = (streak: number) => Math.min(60, streak * 6)

export const dayTotal = (rs: RoundResult[] = []) => rs.reduce((s, r) => s + r.points, 0)

/** Days in a row with a finished daily challenge (5 rounds), ending today or yesterday. */
export function streak(log: GameLog) {
  let d = new Date()
  if ((log[dateStr(d)]?.length ?? 0) < 5) d = new Date(d.getTime() - 86400000)
  let n = 0
  while ((log[dateStr(d)]?.length ?? 0) >= 5) {
    n++
    d = new Date(d.getTime() - 86400000)
  }
  return n
}

export const totalXp = (log: GameLog) => Object.values(log).reduce((s, rs) => s + dayTotal(rs), 0)

/** Level progress: every 500 XP is a level */
export const xpProgress = (log: GameLog) => {
  const xp = totalXp(log)
  return { xp: xp % 500, of: 500 }
}

export const weekPoints = (log: GameLog) =>
  Object.entries(log)
    .filter(([day]) => isoWeek(new Date(day)) === isoWeek())
    .reduce((s, [, rs]) => s + dayTotal(rs), 0)

/** Headline after a round */
export function verdict(diff: number) {
  if (diff <= 3) return 'Zelo blizu.'
  if (diff <= 8) return 'Blizu.'
  if (diff <= 15) return 'Ni slabo.'
  return 'Tokrat mimo.'
}

/** Headline after the day */
export function dayVerdict(rs: RoundResult[]) {
  const avg = rs.reduce((s, r) => s + Math.abs(r.guess - r.actual), 0) / Math.max(1, rs.length)
  return avg <= 6 ? 'Dober občutek.' : avg <= 12 ? 'Lepo napreduješ.' : 'Jutri bo bolje.'
}

/** Badges shown on the results screen */
export function badges(log: GameLog) {
  const all = Object.values(log).flat()
  const eveningHits = all.filter((r) => Number(r.time.slice(11, 13)) >= 18 && Math.abs(r.guess - r.actual) <= 5)
  return [
    { key: 'inverzija', label: 'Nos za\ninverzijo', icon: '/figma/badge-inverzija.svg', earned: eveningHits.length >= 3 },
    { key: 'niz', label: '7 dni\nzapored', icon: '/figma/badge-niz.svg', earned: streak(log) >= 7 },
  ]
}

/** Was the guess in the same learning-scale band as the truth? */
export const sameBand = (a: number, b: number) => learnLevel(a).key === learnLevel(b).key

// The 17 četrtne skupnosti of MOL
export const CETRTI = [
  'Bežigrad', 'Center', 'Črnuče', 'Dravlje', 'Golovec', 'Jarše', 'Moste', 'Polje', 'Posavje',
  'Rožnik', 'Rudnik', 'Sostro', 'Šentvid', 'Šiška', 'Šmarna gora', 'Trnovo', 'Vič',
]

/**
 * DEMO league and friends: there is no server yet, so the other players and četrti have
 * stable pseudo-random scores. Replace with a real leaderboard API after the hackathon.
 */
export function demoLeague(myCetrt: string, myWeek: number) {
  const week = isoWeek()
  return CETRTI.map((c) => {
    let h = week * 31
    for (const ch of c) h = (h * 33 + ch.charCodeAt(0)) % 100003
    return { cetrt: c, points: 3000 + (h % 4000) + (c === myCetrt ? myWeek : 0) }
  }).sort((a, b) => b.points - a.points)
}

export function demoFriends(me: number) {
  const day = Number(dateStr(new Date()).replace(/-/g, ''))
  const friends = [
    { name: 'Nika', points: 900 + (day % 400), me: false },
    { name: 'Luka', points: 700 + ((day * 7) % 450), me: false },
  ]
  return [...friends, { name: 'Ti', points: me, me: true }].sort((a, b) => b.points - a.points)
}

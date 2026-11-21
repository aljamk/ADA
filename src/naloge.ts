// Daily tasks of the Igra tab (Napoved, Kviz, Beseda dneva, Dih). Everything stays on the device.
import type { GameLog } from './game'
import { load, save } from './storage'
import { dateStr, isoWeek } from './time'

export type TaskKey = 'napoved' | 'kviz' | 'beseda' | 'dih'

export interface TaskResult {
  points: number
  [k: string]: unknown
}

/** Per day: which tasks are done and what they earned */
export type TaskLog = Record<string, Partial<Record<TaskKey, TaskResult>>>

/** A forecast the player locked in for tomorrow 8h, resolved the next morning */
export interface Guess {
  made: string // day the guess was made
  target: string // "2026-11-22 08:00"
  station: string // ARSO code
  stationName: string
  base: number // measurement shown when guessing
  choice: 0 | 1 | 2 | null // Boljše / Enako / Slabše, null in expert mode
  value: number // µg/m³ (expert) or base for the simple mode
  model: number | null // calibrated CAMS value for the target, shown only after locking
  actual?: number
  actualSource?: 'MERITEV' | 'MODEL'
}

export const TASK_KEY = 'naloge'
export const GUESS_KEY = 'napovedi'

export const loadTasks = () => load<TaskLog>(TASK_KEY, {})
export const saveTasks = (t: TaskLog) => save(TASK_KEY, t)
export const loadGuesses = () => load<Guess[]>(GUESS_KEY, [])
export const saveGuesses = (g: Guess[]) => save(GUESS_KEY, g)

/** Within ±3 µg/m³ counts as "Enako" */
export const direction = (from: number, to: number): 0 | 1 | 2 => (to < from - 3 ? 0 : to > from + 3 ? 2 : 1)

/** Points for a resolved guess: exact value up to 150, right direction 100 */
export function guessPoints(g: Guess) {
  if (g.actual == null) return 0
  if (g.choice == null) return Math.max(0, 150 - 10 * Math.abs(g.value - g.actual))
  return g.choice === direction(g.base, g.actual) ? 100 : 0
}

/** Did the player beat the model? 1 = player, -1 = model, 0 = tie */
export function vsModel(g: Guess) {
  if (g.actual == null || g.model == null) return null
  if (g.choice == null) {
    const me = Math.abs(g.value - g.actual)
    const m = Math.abs(g.model - g.actual)
    return me < m ? 1 : me > m ? -1 : 0
  }
  const truth = direction(g.base, g.actual)
  const meOk = g.choice === truth
  const mOk = direction(g.base, g.model) === truth
  return meOk === mOk ? 0 : meOk ? 1 : -1
}

const inThisWeek = (day: string) => isoWeek(new Date(day)) === isoWeek()

export const taskWeekPoints = (t: TaskLog) =>
  Object.entries(t)
    .filter(([day]) => inThisWeek(day))
    .reduce((s, [, d]) => s + Object.values(d).reduce((a, r) => a + (r?.points ?? 0), 0), 0)

export const taskTotalPoints = (t: TaskLog) =>
  Object.values(t).reduce((s, d) => s + Object.values(d).reduce((a, r) => a + (r?.points ?? 0), 0), 0)

/** Days in a row with at least one task or Ugani round, ending today or yesterday */
export function playStreak(t: TaskLog, log: GameLog) {
  const played = (d: Date) => Object.keys(t[dateStr(d)] ?? {}).length > 0 || (log[dateStr(d)]?.length ?? 0) > 0
  let d = new Date()
  if (!played(d)) d = new Date(d.getTime() - 86400000)
  let n = 0
  while (played(d)) {
    n++
    d = new Date(d.getTime() - 86400000)
  }
  return n
}

/** League points from forecasts resolved this week */
export const guessWeekPoints = (gs: Guess[]) => gs.filter((g) => g.actual != null && inThisWeek(g.target.slice(0, 10))).reduce((s, g) => s + guessPoints(g), 0)

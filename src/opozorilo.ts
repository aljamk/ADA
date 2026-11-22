// Early warning for decision-makers: will the next days bring an episode? Two signals from the data package's
// notebook 02 (primeri/README.md): the weather rule "wind < 6 km/h, boundary layer < 300 m, no rain" (catches
// about three quarters of exceedances, three quarters of its warnings are false, because exceedances are rare)
// and the model threshold (calibrated CAMS daily mean > 25 µg/m³, the "bad day" of notebook 03; catches 94 %,
// 70 % false). Weather comes from Open-Meteo (listed in the package as a live source), the model from the
// calibrated CAMS forecast the app already has for Bežigrad.
import { ofDay, type Forecast } from './forecast'
import { dateStr } from './time'

const LJ = { lat: 46.0569, lon: 14.5058 }
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LJ.lat}&longitude=${LJ.lon}` +
  '&hourly=wind_speed_10m,boundary_layer_height,precipitation&forecast_days=3&timezone=Europe%2FLjubljana'

export interface Vreme {
  time: string[] // "2026-11-22T00:00" local
  wind: number[] // km/h
  blh: number[] // m
  rain: number[] // mm
}

export async function fetchVreme(): Promise<Vreme> {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const d = (await res.json()) as { hourly: { time: string[]; wind_speed_10m: number[]; boundary_layer_height: number[]; precipitation: number[] } }
  return { time: d.hourly.time, wind: d.hourly.wind_speed_10m, blh: d.hourly.boundary_layer_height, rain: d.hourly.precipitation }
}

export const WIND_MAX = 6 // km/h
export const BLH_MAX = 300 // m
export const RAIN_MAX = 0.5 // mm per day
export const MODEL_BAD = 25 // µg/m³ daily PM2.5

export interface Dan {
  date: string // "2026-11-23"
  label: string // Danes / Jutri / Pojutrišnjem
  wind: number | null // daily mean, km/h
  blh: number | null // daily mean, m
  rain: number | null // daily sum, mm
  stagnant: boolean | null
  model: number | null // daily mean of the calibrated model, µg/m³
  modelWarn: boolean | null
  level: 0 | 1 | 2 // 0 none, 1 one signal, 2 both
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Today, tomorrow and the day after, each with both signals (null where a source does not reach that day) */
export function oceniDneve(vreme: Vreme | null, fc: Forecast | undefined, now = new Date()): Dan[] {
  const labels = ['Danes', 'Jutri', 'Pojutrišnjem']
  return labels.map((label, i) => {
    const date = dateStr(new Date(now.getTime() + i * 86400000))
    const idx = vreme ? vreme.time.map((t, k) => (t.startsWith(date) ? k : -1)).filter((k) => k >= 0) : []
    const wind = idx.length ? mean(idx.map((k) => vreme!.wind[k])) : null
    const blh = idx.length ? mean(idx.map((k) => vreme!.blh[k])) : null
    const rain = idx.length ? idx.reduce((s, k) => s + (vreme!.rain[k] ?? 0), 0) : null
    const stagnant = wind == null || blh == null || rain == null ? null : wind < WIND_MAX && blh < BLH_MAX && rain < RAIN_MAX
    const hours = fc ? ofDay(fc, date) : []
    const model = hours.length >= 12 ? Math.round(mean(hours.map((h) => h.value))!) : null
    const modelWarn = model == null ? null : model > MODEL_BAD
    const level = ((stagnant ? 1 : 0) + (modelWarn ? 1 : 0)) as 0 | 1 | 2
    return { date, label, wind, blh, rain, stagnant, model, modelWarn, level }
  })
}

export const LEVEL_TEXT = ['Slab zrak ni pričakovan', 'Slab zrak je možen', 'Slab zrak je verjeten']
export const LEVEL_COLOR = ['#3bb273', '#f2c94c', '#e5484d']

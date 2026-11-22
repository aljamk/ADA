import type { Reading } from './arso'

// CAMS air-quality model via Open-Meteo (no key, CORS open). This is a MODEL, not a measurement.
// CAMS overestimates Ljubljana in winter (+70 % at Bežigrad in 2025/26), so we scale it
// to the latest ARSO measurement at the same station and hour.

export interface ForecastHour {
  time: string // "2026-11-21 16:00", same format as ARSO
  model: number // raw CAMS value
  value: number // calibrated value
}

export interface Forecast {
  hours: ForecastHour[] // yesterday, today and tomorrow, hourly
  factor: number | null // measured / model, null if no matching measurement
}

export async function fetchForecast(r: Reading): Promise<Forecast> {
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${r.lat}&longitude=${r.lon}&hourly=pm2_5&past_days=1&forecast_days=2&timezone=Europe%2FLjubljana`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = (await res.json()) as { hourly: { time: string[]; pm2_5: (number | null)[] } }

  const raw = data.hourly.time
    .map((t, i) => ({ time: t.replace('T', ' '), model: data.hourly.pm2_5[i] }))
    .filter((h): h is { time: string; model: number } => h.model != null)

  // Calibrate: ratio of the measured value to the model at the hour ARSO last reported
  const atMeasurement = raw.find((h) => h.time === r.from)?.model
  const factor =
    r.pm25 != null && atMeasurement != null && atMeasurement >= 1
      ? Math.min(2, Math.max(0.3, r.pm25 / atMeasurement))
      : null

  return { hours: raw.map((h) => ({ ...h, value: Math.round(h.model * (factor ?? 1)) })), factor }
}

const firstAfter = (fc: Forecast, from: string) => {
  const i = fc.hours.findIndex((h) => h.time > from)
  return i < 0 ? fc.hours.length : i
}

/** The 12 hours after the last measured hour */
export const next12 = (fc: Forecast, from: string) => fc.hours.slice(firstAfter(fc, from), firstAfter(fc, from) + 12)
export const next24 = (fc: Forecast, from: string) => fc.hours.slice(firstAfter(fc, from), firstAfter(fc, from) + 24)

/** The 24 hours up to and including the last measured hour */
export const past24 = (fc: Forecast, from: string) => {
  const end = firstAfter(fc, from)
  return fc.hours.slice(Math.max(0, end - 24), end)
}

export const atHour = (fc: Forecast, time: string) => fc.hours.find((h) => h.time === time)
export const ofDay = (fc: Forecast, date: string) => fc.hours.filter((h) => h.time.startsWith(date))

export function modelLabel(fc: Forecast) {
  return fc.factor != null
    ? `MODEL · CAMS prek Open-Meteo · umerjen na meritev ARSO (×${fc.factor.toFixed(2)})`
    : 'MODEL · CAMS prek Open-Meteo · neumerjen (ni meritve PM2.5), lahko precenjuje'
}

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
  hours: ForecastHour[] // next 12 hours
  factor: number | null // measured / model, null if no matching measurement
}

export async function fetchForecast(r: Reading): Promise<Forecast> {
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${r.lat}&longitude=${r.lon}&hourly=pm2_5&forecast_days=2&timezone=Europe%2FLjubljana`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = (await res.json()) as { hourly: { time: string[]; pm2_5: (number | null)[] } }

  const all = data.hourly.time.map((t, i) => ({ time: t.replace('T', ' '), model: data.hourly.pm2_5[i] }))

  // Calibrate: ratio of the measured value to the model at the hour ARSO last reported
  const atMeasurement = all.find((h) => h.time === r.from)?.model
  const factor =
    r.pm25 != null && atMeasurement != null && atMeasurement >= 1
      ? Math.min(2, Math.max(0.3, r.pm25 / atMeasurement))
      : null

  // Next 12 hours after the last measured hour
  const start = all.findIndex((h) => h.time > r.from)
  const hours = all
    .slice(start, start + 12)
    .filter((h): h is { time: string; model: number } => h.model != null)
    .map((h) => ({ ...h, value: Math.round(h.model * (factor ?? 1)) }))

  return { hours, factor }
}

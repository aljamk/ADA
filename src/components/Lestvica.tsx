import { levelOfAqi } from '../aqi'

// AQI bands of the five levels (US EPA): 0–50, 51–100, 101–150, 151–200, 201+
const BANDS = [0, 50, 100, 150, 200, 300]

/**
 * Visual air-quality scale: five equal colour segments with a marker at the current AQI.
 * Levels are always colour + symbol + word, so the marker is never colour-only.
 */
export default function Lestvica({ aqi, onDark = false }: { aqi: number; onDark?: boolean }) {
  const above = BANDS.findIndex((b, k) => k > 0 && aqi <= b) // first upper bound at or above the value, -1 beyond the scale
  const i = above < 0 ? 4 : above - 1
  const lo = BANDS[i]
  const hi = BANDS[i + 1]
  const pos = ((i + Math.min(1, (aqi - lo) / (hi - lo))) / 5) * 100
  const lvl = levelOfAqi(aqi)
  return (
    <div className={`lestvica${onDark ? ' on-dark' : ''}`} role="img" aria-label={`AQI ${aqi} je na lestvici ${lvl.label.toLowerCase()} (${lo}–${hi})`}>
      <div className="lestvica-bar">
        {[0, 1, 2, 3, 4].map((k) => (
          <span key={k} style={{ background: levelOfAqi(BANDS[k] + 1).color, opacity: k === i ? 1 : 0.45 }} />
        ))}
        <i style={{ left: `${pos}%` }} />
      </div>
      <div className="lestvica-ticks" aria-hidden="true">
        {['Dobro', 'Zmerno', 'Slabo', 'Zelo slabo', 'Nevarno'].map((w, k) => (
          <span key={w} style={{ fontWeight: k === i ? 700 : 400 }}>{w}</span>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { levelOf, type Reading } from './arso'
import { fetchForecast, type Forecast } from './forecast'

export default function Forecast12h({ reading }: { reading: Reading }) {
  const [fc, setFc] = useState<Forecast | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFc(null)
    setError(null)
    fetchForecast(reading).then(setFc).catch((e) => setError(String(e)))
  }, [reading])

  if (error) return <section className="card"><p className="error">Napoved ni na voljo: {error}</p></section>
  if (!fc) return <section className="card"><p className="muted">Nalagam napoved…</p></section>
  if (!fc.hours.length) return null

  const max = Math.max(...fc.hours.map((h) => h.value), 15)
  // Best hour to air out the flat = the lowest forecast hour
  const best = fc.hours.reduce((a, b) => (b.value < a.value ? b : a))

  return (
    <section className="card">
      <h2>Naslednjih 12 ur</h2>
      <div className="strip">
        {fc.hours.map((h) => (
          <div key={h.time} className="bar-col" title={`${h.time.slice(11)}: ~${h.value} µg/m³ (${levelOf(h.value).label})`}>
            <div className="bar" style={{ height: `${(h.value / max) * 100}%`, background: levelOf(h.value).color }} />
            <span>{h.time.slice(11, 13)}</span>
          </div>
        ))}
      </div>
      <p className="tip">
        🪟 Najboljši čas za zračenje: <b>{best.time.slice(11, 13)}h</b> (~{best.value} µg/m³, {levelOf(best.value).label.toLowerCase()})
      </p>
      <div className="tag muted">
        MODEL · CAMS prek Open-Meteo
        {fc.factor != null
          ? ` · umerjen na meritev ARSO (×${fc.factor.toFixed(2)})`
          : ' · neumerjen (ni meritve PM2.5), lahko precenjuje'}
      </div>
    </section>
  )
}

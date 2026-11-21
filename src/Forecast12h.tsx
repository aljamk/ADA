import { levelOf } from './arso'
import HourBars from './components/HourBars'
import { modelLabel, type Forecast, type ForecastHour } from './forecast'
import { hh } from './time'

export default function Forecast12h({ fc, hours }: { fc: Forecast; hours: ForecastHour[] }) {
  if (!hours.length) return null
  // Best hour to air out the flat = the lowest forecast hour
  const best = hours.reduce((a, b) => (b.value < a.value ? b : a))

  return (
    <section className="card">
      <h2>Naslednjih 12 ur</h2>
      <HourBars hours={hours} />
      <p className="tip">
        🪟 Najboljši čas za zračenje: <b>{hh(best.time)}h</b> (~{best.value} µg/m³,{' '}
        {levelOf(best.value).label.toLowerCase()})
      </p>
      <div className="tag muted">{modelLabel(fc)}</div>
    </section>
  )
}

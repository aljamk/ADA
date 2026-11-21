import { modelLabel, past24, type Forecast } from '../forecast'
import HourBars from './HourBars'

interface Props {
  fc: Forecast
  from: string // last measured hour
  measured: Record<string, number> // ARSO readings this device has seen
}

/** Last 24 hours: calibrated model as bars, ARSO measurements as dots. */
export default function History({ fc, from, measured }: Props) {
  const hours = past24(fc, from)
  if (!hours.length) return null
  const seen = hours.filter((h) => measured[h.time] != null).length
  return (
    <section className="card">
      <h2>Zadnjih 24 ur</h2>
      <HourBars hours={hours} measured={measured} labelEvery={3} />
      <div className="tag muted">
        ▮ {modelLabel(fc)}
        <br />● MERITEV ARSO ({seen} ur, shranjene ob odpiranju aplikacije)
      </div>
    </section>
  )
}

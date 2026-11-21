import { levelOf } from '../arso'
import { hh } from '../time'

interface Props {
  hours: { time: string; value: number }[]
  measured?: Record<string, number> // optional ARSO measurements, drawn as dots
  labelEvery?: number
}

/** Hourly bar strip coloured by air quality level. Hover/tap a bar for the value. */
export default function HourBars({ hours, measured = {}, labelEvery = 1 }: Props) {
  const max = Math.max(15, ...hours.map((h) => h.value), ...hours.map((h) => measured[h.time] ?? 0))
  return (
    <div className="strip">
      {hours.map((h, i) => {
        const m = measured[h.time]
        const tip = `${h.time.slice(11)}: model ~${h.value} µg/m³ (${levelOf(h.value).label})${m != null ? ` · meritev ${m}` : ''}`
        return (
          <div key={h.time} className="bar-col" title={tip}>
            {m != null && <div className="mdot" style={{ bottom: `calc(${(m / max) * 100}% + 14px)` }} />}
            <div className="bar" style={{ height: `${(h.value / max) * 100}%`, background: levelOf(h.value).color }} />
            <span>{i % labelEvery === 0 ? hh(h.time) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

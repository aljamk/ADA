import { levelOf } from '../arso'
import type { ForecastHour } from '../forecast'
import { hh } from '../time'

export interface Ring {
  label: string // "Dom" / "Služba"
  station: string
  hours: ForecastHour[] // today 00–23, calibrated model
}

const C = 130 // centre
const RINGS = [
  [96, 122],
  [62, 88],
] // [inner, outer] radius per ring

function sector(h: number, r0: number, r1: number) {
  const gap = 0.012
  const a0 = (h / 24) * 2 * Math.PI - Math.PI / 2 + gap
  const a1 = ((h + 1) / 24) * 2 * Math.PI - Math.PI / 2 - gap
  const p = (r: number, a: number) => `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`
  return `M${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`
}

/** 24-hour clock: outer ring = home, inner ring = work. Outdoor air at each place, hour by hour. */
export default function DayRing({ rings }: { rings: Ring[] }) {
  const nowH = new Date().getHours()
  const nowA = ((nowH + 0.5) / 24) * 2 * Math.PI - Math.PI / 2

  return (
    <section className="card">
      <h2>Moj dan</h2>
      <svg viewBox="0 0 260 260" className="ring" role="img" aria-label="Kakovost zraka po urah za dom in službo">
        {rings.slice(0, 2).map((ring, i) =>
          ring.hours.map((h) => {
            const hour = Number(hh(h.time))
            return (
              <path
                key={ring.label + h.time}
                d={sector(hour, RINGS[i][0], RINGS[i][1])}
                fill={levelOf(h.value).color}
                opacity={hour < nowH ? 0.45 : 1}
              >
                <title>{`${ring.label} · ${hour}h: ~${h.value} µg/m³ (${levelOf(h.value).label})`}</title>
              </path>
            )
          }),
        )}
        <line
          x1={C + 56 * Math.cos(nowA)}
          y1={C + 56 * Math.sin(nowA)}
          x2={C + 128 * Math.cos(nowA)}
          y2={C + 128 * Math.sin(nowA)}
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {[0, 6, 12, 18].map((h) => {
          const a = (h / 24) * 2 * Math.PI - Math.PI / 2
          return (
            <text key={h} x={C + 48 * Math.cos(a)} y={C + 48 * Math.sin(a) + 4} textAnchor="middle" className="ring-label">
              {h}
            </text>
          )
        })}
      </svg>

      <ul className="ring-legend">
        {rings.slice(0, 2).map((ring, i) => {
          const rest = ring.hours.filter((h) => Number(hh(h.time)) >= nowH)
          const best = rest.length ? rest.reduce((a, b) => (b.value < a.value ? b : a)) : undefined
          return (
            <li key={ring.label}>
              <b>{i === 0 ? '◯ zunanji krog' : '◯ notranji krog'} · {ring.label}</b> ({ring.station})
              {best && (
                <div className="muted">
                  Najčistejša ura danes: {hh(best.time)}h (~{best.value} µg/m³)
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="tag muted">
        Zunanji zrak na najbližji postaji, ne v prostoru. MODEL · CAMS, umerjen na meritev ARSO. Pretekle ure so
        zbledele.
      </div>
    </section>
  )
}

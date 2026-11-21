import { useEffect, useRef, useState } from 'react'
import { levelOfPm, usAqi } from '../aqi'
import { shortName, type Reading } from '../arso'
import { atHour, type Forecast } from '../forecast'
import { hourStr } from '../time'

// Schematic map of the Ljubljana basin from Figma (node 29:1781), 390 × 429 design px.
const W = 390
const H = 429
const pctX = (x: number) => `${(x / W) * 100}%`
const pctY = (y: number) => `${(y / H) * 100}%`

const LAYERS = [
  { src: 'map-1', x: 0, y: 0, w: 135, h: 236 },
  { src: 'map-2', x: 280, y: 0, w: 110, h: 429 },
  { src: 'map-3', x: 10, y: 71.33, w: 389, h: 42.67 },
  { src: 'map-4', x: 192.77, y: 220, w: 97.23, h: 210 },
  { src: 'map-5', x: 0, y: 0, w: 390, h: 398 },
  { src: 'map-6', x: 28, y: 88, w: 325, h: 273 },
]
const LABELS = [
  { t: 'ŠIŠKA', x: 39, y: 123 },
  { t: 'BEŽIGRAD', x: 235, y: 125 },
  { t: 'TIVOLI', x: 83, y: 202 },
  { t: 'CENTER', x: 214, y: 248 },
  { t: 'VIČ', x: 78, y: 330 },
  { t: 'RUDNIK', x: 272, y: 356 },
]
// The three official ARSO stations in Ljubljana, at their place on the schematic
export const MAP_STATIONS = [
  { code: 'E403', x: 219, y: 153 }, // LJ Bežigrad
  { code: 'E405', x: 184, y: 234 }, // LJ Celovška
  { code: 'E404', x: 102, y: 299 }, // LJ Vič
]

const SPAN = 10 // hours back and ahead on the slider

/** Same colours as --dobro … --nevarno (they don't change with the theme), for the canvas. */
const LEVEL_HEX = { dobro: '#3bb273', zmerno: '#f2c94c', slabo: '#f2994a', zeloslabo: '#e5484d', nevarno: '#8e4ec6' } as const

/** "2026-11-21 14:00" + n hours, in local time */
const addHours = (t: string, n: number) => hourStr(new Date(new Date(t.replace(' ', 'T')).getTime() + n * 3600000))

/** Slovenian relative hour with dual and plural: pred 1 uro / 2 urama / 3 urami, čez 1 uro / 2 uri / 3 ure / 5 ur */
export function relHour(n: number) {
  if (n === 0) return 'Zdaj'
  const a = Math.abs(n)
  if (n < 0) return `Pred ${a} ${a === 1 ? 'uro' : a === 2 ? 'urama' : 'urami'}`
  return `Čez ${a} ${a === 1 ? 'uro' : a === 2 ? 'uri' : a <= 4 ? 'ure' : 'ur'}`
}

/**
 * Coloured surface like the EEA air-quality maps: every cell gets the level of an
 * inverse-distance-weighted estimate from the stations, drawn small and blurred.
 * It is an ESTIMATE between three stations, not a measurement.
 */
function Surface({ points }: { points: { x: number; y: number; pm: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const cell = 6
    cv.width = Math.ceil(W / cell)
    cv.height = Math.ceil(H / cell)
    ctx.clearRect(0, 0, cv.width, cv.height)
    if (!points.length) return
    for (let gy = 0; gy < cv.height; gy++)
      for (let gx = 0; gx < cv.width; gx++) {
        const x = gx * cell + cell / 2
        const y = gy * cell + cell / 2
        let num = 0
        let den = 0
        for (const p of points) {
          const w = 1 / Math.max(1, (p.x - x) ** 2 + (p.y - y) ** 2)
          num += w * p.pm
          den += w
        }
        ctx.fillStyle = LEVEL_HEX[levelOfPm(num / den).key]
        ctx.fillRect(gx, gy, 1, 1)
      }
  }, [points])
  return <canvas ref={ref} className="map-surface" aria-hidden="true" />
}

interface Props {
  readings: Reading[]
  forecasts: Record<string, Forecast>
}

/** 03 · Zemljevid: measurement or model per station, with a time slider over the next 12 hours (model). */
export default function Zemljevid({ readings, forecasts }: Props) {
  const [mode, setMode] = useState<'meritev' | 'model'>('meritev')
  const [sel, setSel] = useState('E403')
  const [step, setStep] = useState(0) // -SPAN..SPAN hours from the last measured hour; ≠ 0 is always the model

  const valueAt = (code: string): { pm: number; time: string; source: 'MERITEV' | 'MODEL' } | null => {
    const r = readings.find((x) => x.code === code)
    if (!r) return null
    const fc = forecasts[code]
    if (step === 0 && mode === 'meritev') return r.pm25 != null ? { pm: r.pm25, time: r.from, source: 'MERITEV' } : null
    if (!fc) return null
    const h = atHour(fc, addHours(r.from, step))
    return h ? { pm: h.value, time: h.time, source: 'MODEL' } : null
  }

  const selReading = readings.find((r) => r.code === sel)
  const selValue = valueAt(sel)
  const source = step !== 0 ? 'MODEL' : mode === 'meritev' ? 'MERITEV' : 'MODEL'
  const points = MAP_STATIONS.flatMap((s) => {
    const v = valueAt(s.code)
    return v ? [{ x: s.x, y: s.y, pm: v.pm }] : []
  })
  const pointsKey = points.map((p) => p.pm).join(',')
  const stablePoints = useStablePoints(points, pointsKey)

  return (
    <div className="screen">
      <div>
        <p className="t-label">Ljubljanska kotlina</p>
        <p className="t-title">Zemljevid</p>
      </div>

      <div className="map">
        {LAYERS.map((l) => (
          <img key={l.src} src={`/figma/${l.src}.svg`} alt="" style={{ left: pctX(l.x), top: pctY(l.y), width: pctX(l.w), height: pctY(l.h) }} />
        ))}
        <Surface points={stablePoints} />
        {LABELS.map((l) => (
          <span key={l.t} className="map-label" style={{ left: pctX(l.x), top: pctY(l.y) }}>
            {l.t}
          </span>
        ))}
        <span className="map-label" style={{ left: pctX(113), top: pctY(68), fontWeight: 400 }}>Sava</span>
        <span className="map-label" style={{ left: pctX(257), top: pctY(302), fontWeight: 400, fontSize: 11 }}>Ljubljanica</span>

        <div className="seg">
          <button className={mode === 'meritev' && step === 0 ? 'on' : ''} onClick={() => { setMode('meritev'); setStep(0) }}>
            ● Meritev
          </button>
          <button className={mode === 'model' || step !== 0 ? 'on' : ''} onClick={() => setMode('model')}>
            Model
          </button>
        </div>

        {MAP_STATIONS.map((s) => {
          const v = valueAt(s.code)
          return (
            <button
              key={s.code}
              className={`bubble${s.code === sel ? ' sel' : ''}`}
              style={{ left: pctX(s.x), top: pctY(s.y), background: v ? levelOfPm(v.pm).color : 'var(--soft)' }}
              onClick={() => setSel(s.code)}
              aria-label={readings.find((r) => r.code === s.code)?.name}
            >
              {v ? usAqi(v.pm) : '–'}
            </button>
          )
        })}

        <div className="legend">
          <span>● {source} · 3 postaje</span>
          <span>Barvna ploskev: ocena med postajami</span>
        </div>
      </div>

      {selReading && (
        <section className="sheet">
          <div className="now-top">
            <p className="t-sub">{shortName(selReading.name)}</p>
            <span className="chip">{source === 'MERITEV' ? '● MERITEV' : 'MODEL'}</span>
          </div>
          {selValue ? (
            <p className="t-sub">
              {levelOfPm(selValue.pm).symbol} {levelOfPm(selValue.pm).label} · AQI {usAqi(selValue.pm)}
            </p>
          ) : (
            <p className="t-body t-2">Ni podatka za to uro.</p>
          )}
          <p className="t-small">
            PM2,5 {selValue ? `${selValue.pm} µg/m³` : '–'} · uradna postaja ARSO
          </p>
          <p className="timeline-now" aria-live="polite">{relHour(step)}</p>
          <div className="timeline">
            <span className="t-small">pred {SPAN} h</span>
            <input
              type="range"
              min={-SPAN}
              max={SPAN}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              aria-label="Čas: nazaj in naprej po urah"
              aria-valuetext={relHour(step)}
            />
            <span className="t-small">čez {SPAN} h</span>
          </div>
          <p className="t-small" style={{ fontSize: 11 }}>
            Shematski prikaz · {step === 0 && mode === 'meritev' ? 'zdaj je meritev ARSO' : 'za vsako uro nazaj in naprej je izračun modela CAMS, umerjen na meritev'} · barvna ploskev je ocena med tremi postajami
          </p>
        </section>
      )}
    </div>
  )
}

/** Keep the same array object while the values don't change, so the canvas redraws only when it must. */
function useStablePoints<T>(points: T, key: string) {
  const ref = useRef({ key, points })
  if (ref.current.key !== key) ref.current = { key, points }
  return ref.current.points
}

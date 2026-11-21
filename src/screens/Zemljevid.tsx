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

const SPAN = 10 // hours back and ahead on the slider (model)

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

/** Keep the same array object while the values don't change, so the canvas redraws only when it must. */
function useStablePoints<T>(points: T, key: string) {
  const ref = useRef({ key, points })
  if (ref.current.key !== key) ref.current = { key, points }
  return ref.current.points
}

interface Props {
  readings: Reading[]
  forecasts: Record<string, Forecast>
  /** Station chosen in the Zdaj tab */
  station: string
  /** User's own stations for the model view (home, work, …), at least one */
  mine: string[]
  onMine: (codes: string[]) => void
  onAddStation: () => void
}

/**
 * 03 · Zemljevid.
 * MERITEV: the latest ARSO measurement, for every station that reports PM2.5 (map bubbles for Ljubljana, a list for all).
 * MODEL: only the stations the user picked (home, work, …), with a slider from 10 h back to 10 h ahead.
 */
export default function Zemljevid({ readings, forecasts, station, mine, onMine, onAddStation }: Props) {
  const [mode, setMode] = useState<'meritev' | 'model'>('meritev')
  const [sel, setSel] = useState(station)
  const [step, setStep] = useState(0) // -SPAN..SPAN hours from the last measured hour (model only)

  // In the model view the selection is always one of my stations
  const selected = mode === 'model' && !mine.includes(sel) ? mine[0] : sel

  const valueAt = (code: string): { pm: number; time: string; source: 'MERITEV' | 'MODEL' } | null => {
    const r = readings.find((x) => x.code === code)
    if (!r) return null
    if (mode === 'meritev') return r.pm25 != null ? { pm: r.pm25, time: r.from, source: 'MERITEV' } : null
    const fc = forecasts[code]
    if (!fc) return null
    const h = atHour(fc, addHours(r.from, step))
    return h ? { pm: h.value, time: h.time, source: 'MODEL' } : null
  }

  const selReading = readings.find((r) => r.code === selected)
  const selValue = valueAt(selected)
  const withPm = readings.filter((r) => r.pm25 != null)
  const points = MAP_STATIONS.flatMap((s) => {
    const v = valueAt(s.code)
    return v ? [{ x: s.x, y: s.y, pm: v.pm }] : []
  })
  const stablePoints = useStablePoints(points, points.map((p) => p.pm).join(','))
  const shownOnMap = mode === 'meritev' ? MAP_STATIONS : MAP_STATIONS.filter((s) => mine.includes(s.code))

  const pick = (code: string) => setSel(code)
  const remove = (code: string) => {
    if (mine.length <= 1) return
    onMine(mine.filter((c) => c !== code))
    if (selected === code) setSel(mine.find((c) => c !== code) ?? mine[0])
  }

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
          <button className={mode === 'meritev' ? 'on' : ''} onClick={() => { setMode('meritev'); setStep(0) }}>
            ● Meritev
          </button>
          <button className={mode === 'model' ? 'on' : ''} onClick={() => setMode('model')}>
            Model · moje postaje
          </button>
        </div>

        {shownOnMap.map((s) => {
          const v = valueAt(s.code)
          return (
            <button
              key={s.code}
              className={`bubble${s.code === selected ? ' sel' : ''}`}
              style={{ left: pctX(s.x), top: pctY(s.y), background: v ? levelOfPm(v.pm).color : 'var(--soft)' }}
              onClick={() => pick(s.code)}
              aria-label={readings.find((r) => r.code === s.code)?.name}
            >
              {v ? usAqi(v.pm) : '–'}
            </button>
          )
        })}

        <div className="legend">
          <span>{mode === 'meritev' ? `● MERITEV · ${withPm.length} postaj` : `MODEL · ${mine.length} ${mine.length === 1 ? 'postaja' : mine.length === 2 ? 'postaji' : 'postaje'}`}</span>
          <span>Barvna ploskev: ocena med postajami</span>
        </div>
      </div>

      {mode === 'model' && (
        <div className="chips" aria-label="Moje postaje">
          {mine.map((code) => {
            const r = readings.find((x) => x.code === code)
            return (
              <span key={code} className={`chip${code === selected ? ' on' : ''}`}>
                <button onClick={() => pick(code)}>{r ? shortName(r.name) : code}</button>
                {mine.length > 1 && <button className="x" aria-label={`Odstrani ${r ? shortName(r.name) : code}`} onClick={() => remove(code)}>×</button>}
              </span>
            )
          })}
          <button className="chip add" onClick={onAddStation}>+ Dodaj postajo</button>
        </div>
      )}

      {selReading && (
        <section className="sheet">
          <div className="now-top">
            <p className="t-sub">{shortName(selReading.name)}</p>
            <span className="chip">{mode === 'meritev' ? '● MERITEV' : 'MODEL'}</span>
          </div>
          {selValue ? (
            <p className="t-sub">
              {levelOfPm(selValue.pm).symbol} {levelOfPm(selValue.pm).label} · AQI {usAqi(selValue.pm)}
            </p>
          ) : (
            <p className="t-body t-2">{mode === 'model' && !forecasts[selected] ? 'Nalagam model…' : 'Ni podatka za to uro.'}</p>
          )}
          <p className="t-small">
            PM2,5 {selValue ? `${selValue.pm} µg/m³` : '–'} · uradna postaja ARSO
          </p>
          {mode === 'model' ? (
            <>
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
                Za vsako uro nazaj in naprej je izračun modela CAMS, umerjen na zadnjo meritev · postaje izbereš sam(a), npr. doma in v službi
              </p>
            </>
          ) : (
            <p className="t-small" style={{ fontSize: 11 }}>
              Zadnja urna meritev ARSO ({selValue ? `${Number(selValue.time.slice(11, 13))}h` : '–'}) · barvna ploskev je ocena med tremi ljubljanskimi postajami
            </p>
          )}
        </section>
      )}

      {mode === 'meritev' && (
        <>
          <div className="section-head">
            <p className="t-sub">Vse postaje</p>
            <span className="t-small" style={{ fontSize: 11 }}>PM2,5 · zadnja ura</span>
          </div>
          <div className="rows">
            {withPm.map((r) => (
              <button key={r.code} className={`row station${r.code === selected ? ' me' : ''}`} onClick={() => pick(r.code)}>
                <span className="n" style={{ color: levelOfPm(r.pm25 as number).color }}>{levelOfPm(r.pm25 as number).symbol}</span>
                <span>{shortName(r.name)}</span>
                <span className="p">{r.pm25} µg/m³</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

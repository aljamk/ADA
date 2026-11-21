import { useState } from 'react'
import { levelOfPm, usAqi } from '../aqi'
import { shortName, type Reading } from '../arso'
import { atHour, next12, type Forecast } from '../forecast'
import { hh } from '../time'

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

interface Props {
  readings: Reading[]
  forecasts: Record<string, Forecast>
}

/** 03 · Zemljevid: measurement or model per station, with a time slider over the next 12 hours (model). */
export default function Zemljevid({ readings, forecasts }: Props) {
  const [mode, setMode] = useState<'meritev' | 'model'>('meritev')
  const [sel, setSel] = useState('E403')
  const [step, setStep] = useState(0) // 0 = now, 1..12 = hours ahead (model)

  const valueAt = (code: string): { pm: number; time: string; source: 'MERITEV' | 'MODEL' } | null => {
    const r = readings.find((x) => x.code === code)
    if (!r) return null
    const fc = forecasts[code]
    if (step === 0 && mode === 'meritev') return r.pm25 != null ? { pm: r.pm25, time: r.from, source: 'MERITEV' } : null
    if (!fc) return null
    const h = step === 0 ? atHour(fc, r.from) : next12(fc, r.from)[step - 1]
    return h ? { pm: h.value, time: h.time, source: 'MODEL' } : null
  }

  const selReading = readings.find((r) => r.code === sel)
  const selValue = valueAt(sel)
  const source = step > 0 ? 'MODEL' : mode === 'meritev' ? 'MERITEV' : 'MODEL'

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
          <button className={mode === 'model' || step > 0 ? 'on' : ''} onClick={() => setMode('model')}>
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
          <span>● MERITEV · 3</span>
          <span>○ OCENA · občanski senzorji v pripravi</span>
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
          <div className="timeline">
            <span>{selValue ? `${hh(selValue.time)}:00` : '--:--'}</span>
            <input
              type="range"
              min={0}
              max={12}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              aria-label="Ura (0 = zdaj, naprej napoved modela)"
            />
            <span className="t-small">+12 h</span>
          </div>
          <p className="t-small" style={{ fontSize: 11 }}>
            Shematski prikaz · naprej v času je napoved modela CAMS, umerjena na meritev
          </p>
        </section>
      )}
    </div>
  )
}

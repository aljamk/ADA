import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { levelOfPm, usAqi } from '../aqi'
import { inBasin, shortName, type Reading } from '../arso'
import { atHour, type Forecast } from '../forecast'
import { calibrationNote, isCitizen } from '../sensors'
import { hourStr } from '../time'

// The three official ARSO stations in Ljubljana: their forecasts are always fetched (home-town default)
export const MAP_STATIONS = [{ code: 'E403' }, { code: 'E405' }, { code: 'E404' }]

const SPAN = 10 // hours back and ahead on the slider (model)

// Satellite imagery and place labels (Esri; attribution required and shown on the map)
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const PLACES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const ATTR = 'Satelit: Esri, Maxar, Earthstar Geographics · ARSO · CAMS'

/** Ljubljana basin: default view, station list and estimate surface. The challenge is about Ljubljana. */
const BOUNDS: [[number, number], [number, number]] = [[45.88, 14.2], [46.24, 14.85]]
/** How far a station's measurement is taken to say something about the air: full within 3 km, fading out by 8 km */
const FULL_KM = 3
const REACH_KM = 8
const VIEW: [[number, number], [number, number]] = [[46.01, 14.43], [46.11, 14.58]]

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

interface Point {
  lat: number
  lon: number
  pm: number
}

/**
 * Coloured surface like the EEA air-quality maps: every cell gets the level of an
 * inverse-distance-weighted estimate from the stations (distance in km). It is an
 * ESTIMATE between stations, not a measurement. Returned as a PNG data URL.
 */
function surfaceImage(points: Point[]) {
  const cv = document.createElement('canvas')
  const cols = 260
  const rows = 144
  cv.width = cols
  cv.height = rows
  const ctx = cv.getContext('2d')
  if (!ctx || !points.length) return null
  const [[s, w], [n, e]] = BOUNDS
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < cols; gx++) {
      const lat = n - ((gy + 0.5) / rows) * (n - s)
      const lon = w + ((gx + 0.5) / cols) * (e - w)
      let num = 0
      let den = 0
      let dmin = Infinity
      for (const p of points) {
        const dx = (p.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180)
        const dy = (p.lat - lat) * 111
        const d2 = dx * dx + dy * dy
        dmin = Math.min(dmin, Math.sqrt(d2))
        const wgt = 1 / Math.max(1, d2)
        num += wgt * p.pm
        den += wgt
      }
      // A station tells us about its surroundings only: full colour within FULL_KM, nothing beyond REACH_KM
      const a = Math.max(0, Math.min(1, (REACH_KM - dmin) / (REACH_KM - FULL_KM)))
      if (a <= 0) continue
      ctx.fillStyle = LEVEL_HEX[levelOfPm(num / den).key]
      ctx.globalAlpha = a
      ctx.fillRect(gx, gy, 1, 1)
    }
  return cv.toDataURL()
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
  initialMode?: 'meritev' | 'model'
  cetrt?: string | null // the četrt chosen on Zdaj; names its station under "Moje postaje"
}

/**
 * 03 · Zemljevid: satellite map of the Ljubljana basin with the ARSO stations at their real place.
 * MERITEV: the latest hourly measurement for every basin station that reports PM2.5.
 * MODEL: only the stations the user picked (home, work, …), with a slider from 10 h back to 10 h ahead.
 */
export default function Zemljevid({ readings, forecasts, station, mine, onMine, onAddStation, initialMode = 'model', cetrt }: Props) {
  // Under "Moje postaje" the Zdaj station is shown by the name of its četrt, like the card on Zdaj
  const labelOf = (r: Reading) => (mode === 'model' && r.code === station && cetrt ? cetrt : shortName(r.name))
  const [mode, setMode] = useState<'meritev' | 'model'>(initialMode)
  const [sel, setSel] = useState(station)
  const [step, setStep] = useState(0) // -SPAN..SPAN hours from the last measured hour (model only)
  const [info, setInfo] = useState(false) // explanation of the values, behind the round i
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const overlay = useRef<L.ImageOverlay | null>(null)

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
  const withPm = readings.filter((r) => r.pm25 != null && inBasin(r))
  const shown = mode === 'meritev' ? withPm : readings.filter((r) => mine.includes(r.code))
  // The estimate surface always comes from the official stations, in both modes (model values follow the slider)
  const points: Point[] = withPm.filter((r) => !isCitizen(r)).flatMap((r) => {
    const v = valueAt(r.code)
    return v ? [{ lat: r.lat, lon: r.lon, pm: v.pm }] : []
  })
  const pointsKey = points.map((p) => `${p.lat},${p.lon},${p.pm}`).join(';')

  // Map once
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 15, zoomSnap: 0.25 })
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(m) // the strip under the legend
    L.tileLayer(SAT, { attribution: ATTR, maxZoom: 18 }).addTo(m)
    L.tileLayer(PLACES, { maxZoom: 18, opacity: 0.9 }).addTo(m)
    // Keep the bubbles out of the strips covered by the segment control + attribution (top), the zoom
    // buttons (right) and the legend (bottom). Fractional zoom so a narrow phone still gets a tight fit.
    m.fitBounds(VIEW, { paddingTopLeft: [12, 72], paddingBottomRight: [60, 32] })
    markers.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Estimate surface (redrawn when the values change: slider, mode, my stations, new readings)
  useEffect(() => {
    const m = map.current
    if (!m) return
    // An estimate between stations needs at least three of them; one or two would colour the whole country
    const url = points.length >= 3 ? surfaceImage(points) : null
    overlay.current?.remove()
    overlay.current = null
    if (!url) return
    overlay.current = L.imageOverlay(url, BOUNDS, { opacity: 0.45, className: 'map-surface', interactive: false }).addTo(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  // Station bubbles. Bubbles that would overlap at the current zoom are nudged apart a little
  // (a sensor 300 m from a station still gets its own bubble); re-placed after every zoom.
  useEffect(() => {
    const g = markers.current
    const m = map.current
    if (!g || !m) return
    const place = () => {
      g.clearLayers()
      const items = shown.map((r) => ({ r, p: m.latLngToLayerPoint([r.lat, r.lon]) }))
      // Bubbles are 40 px, a selected one 50 px with its ring: 54 px between centres keeps a gap
      const R = 54
      for (let it = 0; it < 40; it++) {
        let moved = false
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i].p
            const b = items[j].p
            const dx = b.x - a.x
            const dy = b.y - a.y
            const d = Math.hypot(dx, dy)
            if (d >= R) continue
            const push = (R - d) / 2 + 0.5
            const ux = d ? dx / d : 1
            const uy = d ? dy / d : 0
            a.x -= ux * push
            a.y -= uy * push
            b.x += ux * push
            b.y += uy * push
            moved = true
          }
        if (!moved) break
      }
      for (const { r, p } of items) {
        const v = valueAt(r.code)
        const lvl = v ? levelOfPm(v.pm) : null
        const icon = L.divIcon({
          className: '',
          html: `<button class="bubble${r.code === selected ? ' sel' : ''}${isCitizen(r) ? ' ocena' : ''}" style="background:${lvl ? lvl.color : 'var(--soft)'}" aria-label="${shortName(r.name)}${isCitizen(r) ? ', občanski senzor, ocena' : ''}">${v ? usAqi(v.pm) : '–'}</button>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
        L.marker(m.layerPointToLatLng(p), { icon, keyboard: false }).on('click', () => setSel(r.code)).addTo(g)
      }
    }
    place()
    m.on('zoomend', place)
    return () => {
      m.off('zoomend', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, selected, mode, readings])

  // Keep the selected station in view
  useEffect(() => {
    const m = map.current
    if (!m || !selReading) return
    // The visible part of the map is between the segment control and the legend/sheet
    const size = m.getSize()
    const inner = L.latLngBounds(m.containerPointToLatLng([30, 80]), m.containerPointToLatLng([size.x - 60, size.y - 44]))
    if (!inner.contains([selReading.lat, selReading.lon])) m.panTo([selReading.lat, selReading.lon])
  }, [selReading])

  const pick = (code: string) => setSel(code)
  const remove = (code: string) => {
    if (code === station) return // the Zdaj station is always the first of my stations
    onMine(mine.filter((c) => c !== code))
    if (selected === code) setSel(mine.find((c) => c !== code) ?? mine[0])
  }

  return (
    <div className="screen">
      <div>
        <p className="t-label">Ljubljanska kotlina · satelit</p>
        <p className="t-title">Zemljevid</p>
      </div>

      <div className="map">
        <div ref={mapEl} className="map-canvas" aria-label="Satelitski zemljevid s postajami ARSO" />

        <div className="seg">
          <button className={mode === 'model' ? 'on' : ''} onClick={() => setMode('model')}>
            Moje postaje
          </button>
          <button className={mode === 'meritev' ? 'on' : ''} onClick={() => { setMode('meritev'); setStep(0) }}>
            Meritve
          </button>
        </div>

      </div>

      {selReading && (
        <section className="sheet">
          {mode === 'model' && (
            <div className="chips" aria-label="Moje postaje">
              {mine.map((code) => {
                const r = readings.find((x) => x.code === code)
                return (
                  <span key={code} className={`chip${code === selected ? ' on' : ''}`}>
                    <button onClick={() => pick(code)} title={code === station ? 'Postaja z zaslona Zdaj' : undefined}>{code === station ? 'Zdaj · ' : ''}{r ? labelOf(r) : code}</button>
                    {code !== station && <button className="x" aria-label={`Odstrani ${r ? shortName(r.name) : code}`} onClick={() => remove(code)}>×</button>}
                  </span>
                )
              })}
              <button className="chip add" onClick={onAddStation}>+ Dodaj postajo</button>
            </div>
          )}
          <div className="now-top">
            <p className="t-h3" style={{ whiteSpace: 'nowrap' }}>Kakovost zraka:</p>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="chip">{mode === 'meritev' ? (isCitizen(selReading) ? '○ OCENA' : '● MERITEV') : 'MODEL'}</span>
              <button className="info-btn" aria-label="Kaj pomenijo vrednosti?" aria-expanded={info} onClick={() => setInfo(!info)}>
                i
              </button>
            </span>
          </div>
          {selValue ? (
            <p className="t-sub">
              {levelOfPm(selValue.pm).labelF} · AQI {usAqi(selValue.pm)}
            </p>
          ) : (
            <p className="t-body t-2">{mode === 'model' && !forecasts[selected] ? 'Nalagam model…' : 'Ni podatka za to uro.'}</p>
          )}
          <p className="t-small">
            {labelOf(selReading)} · PM2,5 {selValue ? `${selValue.pm} µg/m³` : '–'} · {isCitizen(selReading) ? `občanski senzor (ocena, ${calibrationNote(selReading)})` : 'uradna postaja ARSO'}{mode === 'model' && selected === station && cetrt && shortName(selReading.name) !== cetrt ? ` ${shortName(selReading.name)}` : ''}
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
            </>
          ) : null}
          {info && (
            <div className="map-info">
              <p className="t-small">
                <b>Od kod številke?</b>
                <br />
                {mode === 'model'
                  ? 'Vrednosti za pretekle in prihodnje ure izračuna model CAMS (Copernicus). Popravimo jih po zadnji meritvi postaje ARSO.'
                  : `Zadnja urna meritev te postaje${selValue ? ` ob ${Number(selValue.time.slice(11, 13))}h` : ''}: PM2,5 v µg/m³, AQI po lestvici US EPA.`}
              </p>
              {mode === 'model' && (
                <p className="t-small">
                  <b>Postaje</b>
                  <br />
                  Prva je postaja tvoje četrti z zaslona Zdaj. Druge dodaš po želji, na primer tisto pri službi.
                </p>
              )}
              <p className="t-small">
                <b>Barve na zemljevidu</b>
                <br />
                Barva med postajami je ocena, ne meritev. Do 3 km od postaje je polna, do 8 km bledi, dlje je ne rišemo.
              </p>
            </div>
          )}
        </section>
      )}

      {mode === 'meritev' && (
        <>
          <div className="section-head">
            <p className="t-sub">Postaje v kotlini</p>
            <span className="t-small" style={{ fontSize: 11 }}>PM2,5 · zadnja ura</span>
          </div>
          <div className="rows">
            {withPm.map((r) => (
              <button key={r.code} className={`row station${r.code === selected ? ' me' : ''}`} onClick={() => pick(r.code)}>
                <span className="n" style={{ color: levelOfPm(r.pm25 as number).color }}>{levelOfPm(r.pm25 as number).symbol}</span>
                <span>{shortName(r.name)}<span className="t-small" style={{ display: 'block', fontSize: 11 }}>{isCitizen(r) ? 'občanski senzor' : 'uradna postaja ARSO'}</span></span>
                <span className="p">{r.pm25} µg/m³</span>
              </button>
            ))}
            {/* Devices of the package that are not sending right now */}
            {readings.filter((r) => inBasin(r) && r.pm25 == null).map((r) => (
              <div key={r.code} className="row station" style={{ opacity: 0.6 }} aria-disabled>
                <span className="n">·</span>
                <span>{shortName(r.name)}<span className="t-small" style={{ display: 'block', fontSize: 11 }}>občanski senzor · trenutno ne oddaja</span></span>
                <span className="p t-2">–</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

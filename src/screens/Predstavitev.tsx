import { useEffect, useState } from 'react'
import { GOLOB, GOLOB_RDECE, GolobRazpolozenje } from '../components/Golob'
import { LEVELS, type LevelKey } from '../aqi'
import '../predstavitev.css'

/**
 * The desktop presentation: the app inside a phone frame, the Android widgets on the left
 * and Robert's five moods on the right. Phones and the Android app never see this (see main.tsx).
 */

/** true when the window is wide enough for the three columns and the page is not itself the phone's iframe */
export function useWide() {
  const q = '(min-width: 900px)'
  const [wide, setWide] = useState(() => window.self === window.top && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setWide(window.self === window.top && m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

const MOODS: { key: LevelKey; aqi: string; text: string }[] = [
  { key: 'dobro', aqi: 'AQI 0–50', text: 'Pleše in se veseli: poskakuje, maha s krilom, okoli njega plavajo note.' },
  { key: 'zmerno', aqi: 'AQI 51–100', text: 'Stoji in ziba z glavo, kot golobi na ulici: tako-tako.' },
  { key: 'slabo', aqi: 'AQI 101–150', text: 'Prekrižana krila kot prekrižane roke in zavijanje z očmi.' },
  { key: 'zeloslabo', aqi: 'AQI 151–200', text: 'V paniki maha z obema kriloma nad glavo, telo se trese, nad njim utripata klicaja.' },
  { key: 'nevarno', aqi: 'AQI nad 200', text: 'Čepi v gnezdu s skritim krilom, viden je le zgornji del, in se trese.' },
]

/* the widget samples: level index, PM2,5 and how many tasks are still waiting */
const SAMPLES: [number, number, number][] = [
  [1, 16, 4],
  [1, 16, 0],
  [0, 7, 2],
  [3, 62, 1],
]
const N: Record<number, string> = { 1: 'še 1 naloga', 2: 'še 2 nalogi', 3: 'še 3 naloge', 4: 'še 4 naloge' }
const tasksLine = (left: number) => (left === 0 ? 'Vse naloge opravljene. Robert je miren.' : `Robert čaka: ${N[left]}`)

function Widget({ kind, lvl, pm, left }: { kind: 'square' | 'bar' | 'large'; lvl: number; pm: number; left: number }) {
  const level = LEVELS[lvl]
  const img = left === 0 ? GOLOB : GOLOB_RDECE
  const dot = <span className="pw-dot" style={{ background: level.color }} />
  const label = <span className="pw-level">{level.label.toUpperCase()}</span>
  const value = <span className="pw-value">{pm} µg/m³</span>
  if (kind === 'square')
    return (
      <div className="pw pw-square">
        <img className="pw-golob" src={img} alt="" />
        <div className="pw-row">
          {dot}
          {label}
        </div>
        {value}
        <div className="pw-tasks">{left === 0 ? 'Naloge opravljene' : N[left][0].toUpperCase() + N[left].slice(1)}</div>
      </div>
    )
  if (kind === 'bar')
    return (
      <div className="pw pw-bar">
        <div className="pw-col">
          <div className="pw-row">
            {dot}
            {label}
            {value}
          </div>
          <div className="pw-tasks">{tasksLine(left)}</div>
        </div>
        <img className="pw-golob" src={img} alt="" />
      </div>
    )
  return (
    <div className="pw pw-large">
      <div className="pw-col">
        <div className="pw-row">
          {dot}
          {label}
        </div>
        {value}
        <div className="pw-scale">
          {LEVELS.map((l, i) => (
            <span key={l.key} style={{ background: l.color, opacity: i === lvl ? 1 : 0.35 }} />
          ))}
        </div>
        <div className="pw-tasks">{tasksLine(left)}</div>
      </div>
      <img className="pw-golob" src={img} alt="" />
    </div>
  )
}

function WidgetGroup({ title, note, kind }: { title: string; note: string; kind: 'square' | 'bar' | 'large' }) {
  return (
    <section className="pr-group">
      <h2 className="pr-h2">{title}</h2>
      <p className="pr-note">{note}</p>
      <div className="pr-wall">
        {SAMPLES.map(([lvl, pm, left]) => (
          <Widget key={`${lvl}-${left}`} kind={kind} lvl={lvl} pm={pm} left={left} />
        ))}
      </div>
    </section>
  )
}

export default function Predstavitev() {
  const src = `/?embed=1${window.location.hash}`
  const [widgets, setWidgets] = useState(false)
  const [moods, setMoods] = useState(false)
  return (
    <div className="pr">

      <div className="pr-phone-col">
        <div className="pr-phone">
          <div className="pr-statusbar">
            <span>9:41</span>
            <div className="pr-island" />
          </div>
          <iframe className="pr-screen" src={src} title="Kaj dihaš? v telefonu" />
          <div className="pr-homebar">
            <span />
          </div>
        </div>
        <div className="pr-actions">
          <button className="pr-btn" aria-pressed={widgets} onClick={() => setWidgets(!widgets)}>
            {widgets ? 'Skrij widgete' : 'Prikaži widgete'}
          </button>
          <button className="pr-btn" aria-pressed={moods} onClick={() => setMoods(!moods)}>
            {moods ? 'Skrij animacije' : 'Prikaži animacije'}
          </button>
        </div>
      </div>

      {widgets ? (
      <aside className="pr-panel">
        <h1 className="pr-h1">Pripomočki Zrak</h1>
        <p className="pr-lead">
          Trije pripomočki za domači zaslon Androida, vsak dvakrat: ko naloge čakajo (Robert z rdečimi očmi) in ko so opravljene. Brez razlage delcev in brez imena postaje.
        </p>
        <WidgetGroup title="Kvadrat · 2 × 2" note="Robert, raven, vrednost in kratka vrstica nalog." kind="square" />
        <WidgetGroup title="Podolgovat · 4 × 1" note="Raven in vrednost v eni vrstici, naloge pod njo." kind="bar" />
        <WidgetGroup title="Večji · 4 × 2" note="Dodatno barvna lestvica, na kateri sveti trenutna stopnja." kind="large" />
      </aside>
      ) : null}

      {moods ? (
      <aside className="pr-panel">
        <h1 className="pr-h1">Robert v petih razpoloženjih</h1>
        <p className="pr-lead">Tako Robert na zaslonu Zdaj odigra trenutno kakovost zraka, samo s svojim krilom. Iste plasti in iste animacije kot v aplikaciji.</p>
        <div className="pr-moods">
          {MOODS.map((m) => {
            const level = LEVELS.find((l) => l.key === m.key)!
            return (
              <section key={m.key} className="pr-mood">
                <div className="pr-mood-head">
                  <span className="pw-dot" style={{ background: level.color }} />
                  <b>{level.labelF}</b>
                  <span className="pr-aqi">{m.aqi}</span>
                </div>
                <div className="pr-mood-stage">
                  <GolobRazpolozenje level={m.key} size={150} />
                </div>
                <p className="pr-note">{m.text}</p>
              </section>
            )
          })}
        </div>
        <p className="pr-note">Pri vklopljenem zmanjšanem gibanju v sistemu Robert miruje.</p>
      </aside>
      ) : null}
    </div>
  )
}

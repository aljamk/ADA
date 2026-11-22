import { useState } from 'react'
import { levelOfPm } from '../aqi'
import { GolobRece } from '../components/Golob'
import { shortName, type Reading } from '../arso'
import { estimateFor, type Cetrt } from '../cetrti'
import { MAP_STATIONS } from './Zemljevid'

/** "2026-11-22 09:00" → "22. 11. ob 9h" */
const when = (t: string) => `${Number(t.slice(8, 10))}. ${Number(t.slice(5, 7))}. ob ${Number(t.slice(11, 13))}h`

interface Props {
  readings: Reading[]
  cetrti: Cetrt[]
  /** Your četrt, chosen on Zdaj (location is chosen only there) */
  mine: string | null
  station: string
}

/**
 * 10 · Četrti: the 17 četrtne skupnosti of Ljubljana ranked from the cleanest to the most polluted right now.
 * The value per četrt is an ESTIMATE: the current measurement of the three ARSO stations, interpolated
 * to the četrt and scaled by its long-term exposure index. It refreshes with every ARSO hour.
 */
export default function Cetrti({ readings, cetrti, mine, station }: Props) {
  const [info, setInfo] = useState(false)

  const stations = readings.filter((r) => MAP_STATIONS.some((s) => s.code === r.code) && r.pm25 != null)
  const updated = stations.map((s) => s.from).sort().pop()
  const my = readings.find((r) => r.code === station)
  const rows = cetrti
    .map((c) => {
      return { ...c, pm: estimateFor(c, stations) }
    })
    .sort((a, b) => (a.pm ?? Infinity) - (b.pm ?? Infinity))

  // Golob comments on your četrt: praise among the five cleanest, a light tease otherwise (the lines from the approved preview)
  const myIdx = rows.findIndex((c) => c.ime === mine)
  const myRow = myIdx >= 0 ? rows[myIdx] : null
  const golob = !myRow || myRow.pm == null
    ? 'Še računam. Golobi nismo hitri z matematiko.'
    : myIdx < 5
      ? `${myRow.ime} je med petimi najčistejšimi. Tukaj bi gnezdil tudi jaz.`
      : `${myRow.ime} je ${myIdx + 1}. od vrha? Jaz bi se preselil. Hecam se. Malo.`

  return (
    <div className="screen">
      <div>
        <p className="t-label">Ljubljana · od najčistejše do najbolj onesnažene</p>
        <p className="t-title">Četrti</p>
      </div>

      <section className="card" style={{ display: 'grid', gap: 8 }}>
        <div className="now-top">
          <p className="t-small" style={{ fontWeight: 700 }}>
            {updated ? `Posodobljeno ${when(updated)}` : 'Čakam na meritve ARSO…'}
          </p>
          <button className="info-btn" aria-label="Kako nastane ocena?" aria-expanded={info} onClick={() => setInfo(!info)}>
            i
          </button>
        </div>
        {info && (
          <p className="t-small">
            Ocena PM2,5 za vsako četrt: meritve postaj {stations.map((s) => shortName(s.name)).join(', ') || 'ARSO'}, preračunane na četrt in utežene z njenim indeksom izpostavljenosti. Osveži se vsako uro z ARSO.
          </p>
        )}
      </section>

      <GolobRece text={golob} />

      <div className="rows" role="table" aria-label="Četrti po čistoči zraka">
        {rows.map((c, i) => {
          const lvl = c.pm != null ? levelOfPm(c.pm) : null
          return (
            <div key={c.ime} role="row" className={c.ime === mine ? 'row me' : 'row'} style={{ height: 52 }} aria-current={c.ime === mine ? 'true' : undefined}>
              <span className="n">{i + 1}</span>
              <span>
                {c.ime}
                {c.ime === mine && my && (
                  <span className="chip" style={{ height: 20, fontSize: 11, marginLeft: 8, background: 'var(--accent)', color: 'var(--on-accent)' }} title={`Vir na zaslonu Zdaj: ${shortName(my.name)}`}>
                    tvoja četrt
                  </span>
                )}
                {lvl && <span className="t-small" style={{ display: 'block', fontSize: 11 }}>{lvl.labelF} · ocena</span>}
              </span>
              <span className="p" style={{ color: lvl?.color }}>{c.pm != null ? `${c.pm} µg/m³` : '–'}</span>
            </div>
          )
        })}
      </div>

      <div className="map-info">
        <p className="t-small">
          <b>Tvoja četrt</b>
          <br />
          Izbereš jo na zaslonu Zdaj.
        </p>
        <p className="t-small">
          <b>OCENA, ne meritev</b>
          <br />
          V Ljubljani merijo le tri uradne postaje ARSO, zato so vrednosti po četrtih ocenjene. Vrstni red se sproti spreminja, majhne razlike med sosednjimi četrtmi pa ne pomenijo nujno, da je zrak res drugačen.
        </p>
      </div>
    </div>
  )
}

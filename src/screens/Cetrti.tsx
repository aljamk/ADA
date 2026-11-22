import { useEffect, useState } from 'react'
import { levelOfPm } from '../aqi'
import { GolobRece } from '../components/Golob'
import { distanceKm, shortName, type Reading } from '../arso'
import { MAP_STATIONS } from './Zemljevid'

interface Cetrt {
  ime: string
  rel: number // long-term exposure index relative to the city average (1.0), from cs_kazalniki
  lat: number
  lon: number
}

/** Inverse-distance estimate of the current PM2.5 at a point, from the Ljubljana stations (km) */
function idw(lat: number, lon: number, stations: Reading[]) {
  let num = 0
  let den = 0
  for (const s of stations) {
    const dx = (s.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180)
    const dy = (s.lat - lat) * 111
    const w = 1 / Math.max(1, dx * dx + dy * dy)
    num += w * (s.pm25 as number)
    den += w
  }
  return den ? num / den : null
}

/** "2026-11-22 09:00" → "22. 11. ob 9h" */
const when = (t: string) => `${Number(t.slice(8, 10))}. ${Number(t.slice(5, 7))}. ob ${Number(t.slice(11, 13))}h`

interface Props {
  readings: Reading[]
  /** Station chosen in the Zdaj tab: its četrt is marked as yours */
  station: string
}

/**
 * 10 · Četrti: the 17 četrtne skupnosti of Ljubljana ranked from the cleanest to the most polluted right now.
 * The value per četrt is an ESTIMATE: the current measurement of the three ARSO stations, interpolated
 * to the četrt and scaled by its long-term exposure index. It refreshes with every ARSO hour.
 */
export default function Cetrti({ readings, station }: Props) {
  const [cetrti, setCetrti] = useState<Cetrt[]>([])
  const [info, setInfo] = useState(false)
  useEffect(() => {
    fetch('/data/cetrti.json').then((r) => r.json()).then(setCetrti).catch(() => {})
  }, [])

  const stations = readings.filter((r) => MAP_STATIONS.some((s) => s.code === r.code) && r.pm25 != null)
  const updated = stations.map((s) => s.from).sort().pop()
  const my = readings.find((r) => r.code === station)
  const mine = my && cetrti.length ? cetrti.reduce((best, c) => (distanceKm(c.lat, c.lon, my.lat, my.lon) < distanceKm(best.lat, best.lon, my.lat, my.lon) ? c : best)).ime : null
  const rows = cetrti
    .map((c) => {
      const base = idw(c.lat, c.lon, stations)
      return { ...c, pm: base == null ? null : Math.round(base * c.rel) }
    })
    .sort((a, b) => (a.pm ?? Infinity) - (b.pm ?? Infinity))

  // Golob comments on your četrt: praise among the five cleanest, a light tease otherwise
  const myIdx = rows.findIndex((c) => c.ime === mine)
  const myRow = myIdx >= 0 ? rows[myIdx] : null
  const day = Math.floor(Date.now() / 86400000)
  const golob = !myRow || myRow.pm == null
    ? 'Še računam. Golobi nismo hitri z matematiko.'
    : myIdx < 5
      ? [`${myRow.ime} je med petimi najčistejšimi. Tukaj bi gnezdil tudi jaz.`, `${myRow.ime}: ${myRow.pm} µg/m³. Dihaj, splača se.`, `Lepo. ${myRow.ime} je danes ${myIdx + 1}. najčistejša. Ne hvali se preveč.`][day % 3]
      : [`${myRow.ime} je šele ${myIdx + 1}. po čistoči? Jaz bi se preselil. Hecam se. Malo.`, `Si res v ${myRow.ime}? Prosim, ne diši pregloboko.`, `${myRow.ime}: ${myRow.pm} µg/m³. Danes letim drugam, brez zamere.`, `${myRow.ime} ni med petimi najčistejšimi. Naloge v Igri ne čistijo zraka, ampak vsaj mene razvedrijo.`][day % 4]

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
                  <span className="chip" style={{ height: 20, fontSize: 11, marginLeft: 8, background: 'var(--accent)', color: 'var(--on-accent)' }} title={`Postaja ${shortName(my.name)} z zaslona Zdaj`}>
                    tvoja četrt
                  </span>
                )}
                {lvl && <span className="t-small" style={{ display: 'block', fontSize: 11 }}>{lvl.symbol} {lvl.label} · ocena</span>}
              </span>
              <span className="p" style={{ color: lvl?.color }}>{c.pm != null ? `${c.pm} µg/m³` : '–'}</span>
            </div>
          )
        })}
      </div>

      <p className="t-small" style={{ fontSize: 11 }}>
        OCENA, ne meritev: v Ljubljani merijo tri uradne postaje ARSO. Vrstni red se spreminja z meritvami, razlike med sosednjimi četrtmi so lahko znotraj napake ocene.
      </p>
    </div>
  )
}

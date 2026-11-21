import { useEffect, useState } from 'react'
import { levelOfPm } from '../aqi'
import { shortName, type Reading } from '../arso'
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
}

/**
 * 10 · Četrti: the 17 četrtne skupnosti of Ljubljana ranked from the most to the least polluted right now.
 * The value per četrt is an ESTIMATE: the current measurement of the three ARSO stations, interpolated
 * to the četrt and scaled by its long-term exposure index. It refreshes with every ARSO hour.
 */
export default function Cetrti({ readings }: Props) {
  const [cetrti, setCetrti] = useState<Cetrt[]>([])
  useEffect(() => {
    fetch('/data/cetrti.json').then((r) => r.json()).then(setCetrti).catch(() => {})
  }, [])

  const stations = readings.filter((r) => MAP_STATIONS.some((s) => s.code === r.code) && r.pm25 != null)
  const updated = stations.map((s) => s.from).sort().pop()
  const rows = cetrti
    .map((c) => {
      const base = idw(c.lat, c.lon, stations)
      return { ...c, pm: base == null ? null : Math.round(base * c.rel) }
    })
    .sort((a, b) => (b.pm ?? -1) - (a.pm ?? -1))

  return (
    <div className="screen">
      <div>
        <p className="t-label">Ljubljana · od najbolj do najmanj onesnažene</p>
        <p className="t-title">Četrti</p>
      </div>

      <section className="card" style={{ display: 'grid', gap: 4 }}>
        <p className="t-small" style={{ fontWeight: 700 }}>
          {updated ? `Posodobljeno ${when(updated)}` : 'Čakam na meritve ARSO…'}
        </p>
        <p className="t-small">
          Ocena PM2,5 za vsako četrt: meritve postaj {stations.map((s) => shortName(s.name)).join(', ') || 'ARSO'}, preračunane na četrt in uteženo z njenim indeksom izpostavljenosti. Osveži se vsako uro z ARSO.
        </p>
      </section>

      <div className="rows" role="table" aria-label="Četrti po onesnaženosti">
        {rows.map((c, i) => {
          const lvl = c.pm != null ? levelOfPm(c.pm) : null
          return (
            <div key={c.ime} role="row" className="row" style={{ height: 52 }}>
              <span className="n">{i + 1}</span>
              <span>
                {c.ime}
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

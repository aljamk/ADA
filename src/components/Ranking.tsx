import { useState } from 'react'
import { isLjubljana, levelOf, type Reading } from '../arso'

interface Props {
  readings: Reading[]
  station: string
  onPick: (code: string) => void
}

/**
 * Stations ranked by the current measured PM2.5 (cleanest first).
 * Ranks measuring points, not neighbourhoods: the official stations can't show street-level differences.
 */
export default function Ranking({ readings, station, onPick }: Props) {
  const [lj, setLj] = useState(true)
  const rows = readings
    .filter((r) => r.pm25 != null && (!lj || isLjubljana(r)))
    .sort((a, b) => a.pm25! - b.pm25!)
  const mineIdx = rows.findIndex((r) => r.code === station)
  const median = rows.length ? rows[Math.floor(rows.length / 2)].pm25! : 0
  const mine = rows[mineIdx]

  return (
    <section className="card">
      <h2>Postaje zdaj</h2>
      <div className="chips">
        <button className={lj ? 'chip active' : 'chip'} onClick={() => setLj(true)}>
          Ljubljana z okolico
        </button>
        <button className={!lj ? 'chip active' : 'chip'} onClick={() => setLj(false)}>
          Vsa Slovenija
        </button>
      </div>
      {mine && (
        <p>
          Tvoja postaja je <b>{mineIdx + 1}. od {rows.length}</b>
          {mine.pm25! < median ? ' · čistejša od večine' : mine.pm25! > median ? ' · slabša od večine' : ''}.
        </p>
      )}
      <ol className="league">
        {rows.map((r, i) => (
          <li key={r.code} className={r.code === station ? 'mine' : ''} onClick={() => onPick(r.code)}>
            <span>
              {i + 1}. {r.name}
            </span>
            <span>
              <span className="dot small" style={{ background: levelOf(r.pm25!).color }} /> <b>{r.pm25}</b>{' '}
              <small className="muted">µg/m³</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="tag muted">
        MERITEV · ARSO · zadnja ura. Razvrščamo merilna mesta, ne četrti: vrednost velja za okolico postaje, ne za
        tvojo ulico.
      </div>
    </section>
  )
}

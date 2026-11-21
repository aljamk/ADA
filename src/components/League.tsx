import { CETRTI, demoLeague } from '../game'

interface Props {
  cetrt: string
  onCetrt: (c: string) => void
  weekPoints: number
}

/** Weekly league of the 17 četrtne skupnosti, ranked by forecasting points (not by air quality). */
export default function League({ cetrt, onCetrt, weekPoints }: Props) {
  const table = demoLeague(cetrt, weekPoints)
  return (
    <section className="card">
      <h2>Liga četrti · ta teden</h2>
      <label className="muted">
        Igram za:{' '}
        <select value={cetrt} onChange={(e) => onCetrt(e.target.value)}>
          {CETRTI.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <ol className="league">
        {table.map((row, i) => (
          <li key={row.cetrt} className={row.cetrt === cetrt ? 'mine' : ''}>
            <span>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`} {row.cetrt}
            </span>
            <b>{row.points}</b>
          </li>
        ))}
      </ol>
      <div className="tag muted">
        DEMO · točke drugih četrti so izmišljene, dokler liga nima strežnika. Lestvica je po točnosti napovedi, ne po
        kakovosti zraka: meritve ne pokažejo razlik med četrtmi.
      </div>
    </section>
  )
}

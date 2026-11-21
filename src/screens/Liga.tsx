import { CETRTI, demoLeague, weekPoints, type GameLog } from '../game'

/** 1240 -> "1.240" */
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

interface Props {
  log: GameLog
  cetrt: string
  onCetrt: (c: string) => void
}

/** Liga četrtnih skupnosti: no accounts, your points simply count towards the četrt you pick. */
export default function Liga({ log, cetrt, onCetrt }: Props) {
  const mine = weekPoints(log)
  const league = demoLeague(cetrt, mine)
  const rank = league.findIndex((l) => l.cetrt === cetrt) + 1
  const tier = (r: number) => (r <= 2 ? 'Zlata' : r <= 8 ? 'Srebrna' : 'Bronasta')

  return (
    <div className="screen">
      <div>
        <p className="t-label">Ta teden</p>
        <p className="t-title">Liga četrti</p>
      </div>

      <section className="card">
        <p className="t-small" style={{ fontWeight: 500 }}>Igraš za četrt</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <select value={cetrt} onChange={(e) => onCetrt(e.target.value)} aria-label="Izberi četrt" style={{ font: 'inherit', fontSize: 22, fontWeight: 700, color: 'var(--text)', background: 'none', border: 'none', padding: 0 }}>
            {CETRTI.map((c) => <option key={c}>{c}</option>)}
          </select>
          <b className="t-sub" style={{ color: 'var(--accent)' }}>{rank}. / {league.length}</b>
        </div>
        <p className="t-small" style={{ fontWeight: 500 }}>
          {tier(rank)} liga · tvoj prispevek ta teden: {fmt(mine)} točk
        </p>
      </section>

      <div className="rows" role="table" aria-label="Lestvica četrtnih skupnosti">
        {league.map((l, i) => (
          <div key={l.cetrt} role="row" className={l.cetrt === cetrt ? 'row me' : 'row'}>
            <span className="n">{i + 1}</span>
            <span>
              {l.cetrt}
              {(i === 1 || i === 7) && <span className="t-small" style={{ display: 'block', fontSize: 11, fontWeight: 500 }}>meja: {tier(i + 1).toLowerCase()} liga</span>}
            </span>
            <span className="p">{fmt(l.points)}</span>
          </div>
        ))}
      </div>

      <p className="t-small" style={{ fontSize: 11 }}>
        Brez registracije: točke iz igre Ugani zrak se prištejejo četrti, ki jo izbereš. Lestvica je po točkah igre, ne po kakovosti zraka. Točke drugih četrti so zaenkrat primer.
      </p>
    </div>
  )
}

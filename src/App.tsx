import { useEffect, useState } from 'react'
import { BUCKETS, fetchArso, levelOf, type Reading } from './arso'
import Forecast12h from './Forecast12h'

interface Bet {
  station: string
  target: string // "YYYY-MM-DD 08:00" — tomorrow's 8–9h ARSO reading
  bucket: string
  points?: number
  actual?: number
}

const pad = (n: number) => String(n).padStart(2, '0')
function tomorrow8() {
  const d = new Date(Date.now() + 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 08:00`
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [station, setStation] = useState(() => load('station', 'E403')) // LJ Bežigrad
  const [bets, setBets] = useState<Bet[]>(() => load('bets', []))

  useEffect(() => {
    fetchArso().then(setReadings).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => save('station', station), [station])
  useEffect(() => save('bets', bets), [bets])

  // Resolve bets whose target hour is in the current ARSO feed
  useEffect(() => {
    if (!readings.length) return
    setBets((bs) =>
      bs.map((b) => {
        if (b.points !== undefined) return b
        const r = readings.find((x) => x.code === b.station && x.from === b.target)
        if (r?.pm25 == null) return b
        const correct = BUCKETS.find((k) => k.key === b.bucket)!.test(r.pm25)
        return { ...b, actual: r.pm25, points: correct ? 100 : 0 }
      }),
    )
  }, [readings])

  const current = readings.find((r) => r.code === station)
  const target = tomorrow8()
  const openBet = bets.find((b) => b.station === station && b.target === target)
  const points = bets.reduce((s, b) => s + (b.points ?? 0), 0)

  return (
    <main>
      <header>
        <h1>Zrak, ki ga dihamo</h1>
        <span className="points">⭐ {points}</span>
      </header>

      <select value={station} onChange={(e) => setStation(e.target.value)}>
        {readings.length === 0 && <option value={station}>Nalagam postaje…</option>}
        {readings.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>

      {error && <p className="error">Napaka pri branju ARSO: {error}</p>}

      {current && (
        <section className="card now">
          <div className="tag">MERITEV · ARSO · {current.from}</div>
          {current.pm25 != null ? (
            <>
              <div className="value">
                <span className="dot" style={{ background: levelOf(current.pm25).color }} />
                {current.pm25} <small>µg/m³ PM2.5</small>
              </div>
              <div className="level">{levelOf(current.pm25).label}</div>
            </>
          ) : (
            <div className="value">Ta postaja ne meri PM2.5</div>
          )}
          {current.pm10 != null && <div className="sub">PM10: {current.pm10} µg/m³</div>}
        </section>
      )}

      {current && <Forecast12h reading={current} />}

      <section className="card game">
        <h2>Napovej jutri</h2>
        <p>Kakšen bo PM2.5 jutri ob 8h na postaji {current?.name ?? station}?</p>
        {openBet ? (
          <p className="placed">
            Tvoja napoved: <b>{BUCKETS.find((b) => b.key === openBet.bucket)?.label}</b>. Razreši se jutri
            ob ~9:45.
          </p>
        ) : (
          <div className="buttons">
            {BUCKETS.map((b) => (
              <button key={b.key} onClick={() => setBets([...bets, { station, target, bucket: b.key }])}>
                {b.label}
                <small>{b.hint}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {bets.some((b) => b.points !== undefined) && (
        <section className="card">
          <h2>Rezultati</h2>
          <ul>
            {bets
              .filter((b) => b.points !== undefined)
              .map((b) => (
                <li key={b.station + b.target}>
                  {b.target} · {b.bucket} → izmerjeno {b.actual} µg/m³ · {b.points ? '✅ +100' : '❌'}
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  )
}

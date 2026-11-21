import { useEffect, useState } from 'react'
import { BUCKETS, fetchArso, levelOf, type Reading } from './arso'
import Forecast12h from './Forecast12h'
import History from './components/History'
import StationSearch from './components/StationSearch'
import { fetchForecast, next12, type Forecast } from './forecast'
import { load, save } from './storage'
import { dateStr, tomorrow8 } from './time'

// ARSO readings seen on this device: { stationCode: { "YYYY-MM-DD HH:00": pm25 } }
type Observations = Record<string, Record<string, number>>

function addObservations(obs: Observations, readings: Reading[]): Observations {
  const cutoff = dateStr(new Date(Date.now() - 7 * 86400000))
  const next: Observations = {}
  for (const [code, hours] of Object.entries(obs))
    next[code] = Object.fromEntries(Object.entries(hours).filter(([t]) => t >= cutoff))
  for (const r of readings) if (r.pm25 != null) next[r.code] = { ...next[r.code], [r.from]: r.pm25 }
  return next
}

interface Bet {
  station: string
  target: string // "YYYY-MM-DD 08:00" — tomorrow's 8–9h ARSO reading
  bucket: string
  points?: number
  actual?: number
}

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [station, setStation] = useState(() => load('station', 'E403')) // LJ Bežigrad
  const [bets, setBets] = useState<Bet[]>(() => load('bets', []))
  const [obs, setObs] = useState<Observations>(() => load('obs', {}))
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({})

  // Load ARSO now and every 15 minutes (feed updates ~45 min past the hour)
  useEffect(() => {
    const get = () =>
      fetchArso()
        .then((rs) => {
          setReadings(rs)
          setObs((o) => addObservations(o, rs))
          setForecasts({})
        })
        .catch((e) => setError(String(e)))
    get()
    const id = setInterval(get, 15 * 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => save('station', station), [station])
  useEffect(() => save('bets', bets), [bets])
  useEffect(() => save('obs', obs), [obs])

  const current = readings.find((r) => r.code === station)

  // Model forecast per station (fetched on demand, calibrated to that station's last reading)
  useEffect(() => {
    if (!current || forecasts[current.code]) return
    fetchForecast(current)
      .then((fc) => setForecasts((f) => ({ ...f, [current.code]: fc })))
      .catch((e) => setError(`Napoved ni na voljo: ${e}`))
  }, [current, forecasts])
  const fc = current ? forecasts[current.code] : undefined

  // Resolve bets from any ARSO reading this device has seen for the target hour
  useEffect(() => {
    setBets((bs) =>
      bs.map((b) => {
        const actual = obs[b.station]?.[b.target]
        if (b.points !== undefined || actual == null) return b
        const correct = BUCKETS.find((k) => k.key === b.bucket)!.test(actual)
        return { ...b, actual, points: correct ? 100 : 0 }
      }),
    )
  }, [obs])
  const target = tomorrow8()
  const openBet = bets.find((b) => b.station === station && b.target === target)
  const points = bets.reduce((s, b) => s + (b.points ?? 0), 0)

  return (
    <main>
      <header>
        <h1>Zrak, ki ga dihamo</h1>
        <span className="points">⭐ {points}</span>
      </header>

      <StationSearch readings={readings} value={station} onChange={setStation} />

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

      {current && fc && <Forecast12h fc={fc} hours={next12(fc, current.from)} />}
      {current && fc && <History fc={fc} from={current.from} measured={obs[current.code] ?? {}} />}

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

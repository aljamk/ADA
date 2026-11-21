import { useEffect, useRef, useState } from 'react'
import { fetchArso, type Reading } from './arso'
import Forecast12h from './Forecast12h'
import Alerts from './components/Alerts'
import DayRing from './components/DayRing'
import Places from './components/Places'
import Game from './components/Game'
import History from './components/History'
import League from './components/League'
import Me from './components/Me'
import NowCard from './components/NowCard'
import StationSearch from './components/StationSearch'
import { atHour, fetchForecast, next12, ofDay, type Forecast } from './forecast'
import { randomNickname, resolveBet, type Bet, type BucketKey } from './game'
import type { ProfileKey } from './profile'
import { load, save } from './storage'
import { dateStr, isoWeek, tomorrow8 } from './time'

const TABS = [
  { key: 'zdaj', label: 'Zdaj', icon: '💨' },
  { key: 'igra', label: 'Igra', icon: '🎯' },
  { key: 'dan', label: 'Moj dan', icon: '🕓' },
  { key: 'jaz', label: 'Jaz', icon: '🙂' },
] as const
type TabKey = (typeof TABS)[number]['key']

// Pitch helper: open the app with ?demo=1 to resolve a bet on the spot
const DEMO = new URLSearchParams(location.search).has('demo')

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

/** Small hook: state that is persisted to localStorage */
function useStored<T>(key: string, init: T | (() => T)) {
  const [v, setV] = useState<T>(() => load(key, typeof init === 'function' ? (init as () => T)() : init))
  useEffect(() => save(key, v), [key, v])
  return [v, setV] as const
}

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({})
  const [tab, setTab] = useState<TabKey>('zdaj')
  const requested = useRef(new Set<string>()) // stations whose forecast is being fetched

  const [station, setStation] = useStored('station', 'E403') // LJ Bežigrad
  const [bets, setBets] = useStored<Bet[]>('bets', [])
  const [obs, setObs] = useStored<Observations>('obs', {})
  const [profile, setProfile] = useStored<ProfileKey>('profile', 'splosno')
  const [notify, setNotify] = useStored('notify', false)
  const [nickname] = useStored('nickname', randomNickname)
  const [cetrt, setCetrt] = useStored('cetrt', 'Bežigrad')
  const [home, setHome] = useStored('home', 'E403') // LJ Bežigrad
  const [work, setWork] = useStored('work', 'E404') // LJ Vič

  // Load ARSO now and every 15 minutes (feed updates ~45 min past the hour)
  useEffect(() => {
    const get = () =>
      fetchArso()
        .then((rs) => {
          setReadings(rs)
          setObs((o) => addObservations(o, rs))
          setForecasts({})
          requested.current.clear()
        })
        .catch((e) => setError(`Napaka pri branju ARSO: ${e}`))
    get()
    const id = setInterval(get, 15 * 60000)
    return () => clearInterval(id)
  }, [setObs])

  const current = readings.find((r) => r.code === station)

  // Model forecast per station in use (fetched on demand, calibrated to that station's last reading)
  useEffect(() => {
    for (const code of new Set([station, home, work])) {
      const r = readings.find((x) => x.code === code)
      if (!r || forecasts[code] || requested.current.has(code)) continue
      requested.current.add(code)
      fetchForecast(r)
        .then((fc) => setForecasts((f) => ({ ...f, [code]: fc })))
        .catch((e) => setError(`Napoved ni na voljo: ${e}`))
    }
  }, [readings, station, home, work, forecasts])
  const fc = current ? forecasts[current.code] : undefined
  const hours12 = current && fc ? next12(fc, current.from) : []

  // Resolve bets from any ARSO reading this device has seen for the target hour
  useEffect(() => {
    setBets((bs) =>
      bs.map((b) => {
        const actual = obs[b.station]?.[b.target]
        return b.points === undefined && actual != null ? resolveBet(b, actual) : b
      }),
    )
  }, [obs, setBets])

  const target = tomorrow8()
  const openBet = bets.find((b) => b.station === station && b.target === target)
  const points = bets.reduce((s, b) => s + (b.points ?? 0), 0)
  const week = isoWeek()
  const weekPoints = bets
    .filter((b) => b.points && isoWeek(new Date(b.target.replace(' ', 'T'))) === week)
    .reduce((s, b) => s + (b.points ?? 0), 0)

  const placeBet = (bucket: BucketKey) => {
    if (openBet) return
    // The model's forecast is stored now and revealed after resolution ("Premagaj model")
    const model = fc ? atHour(fc, target)?.value : undefined
    setBets([...bets, { station, stationName: current?.name, target, bucket, model }])
  }

  const demoResolve = () => {
    if (!openBet || current?.pm25 == null) return
    setBets(bets.map((b) => (b === openBet ? resolveBet(b, current.pm25!) : b)))
  }

  return (
    <main>
      <header>
        <h1>Zrak, ki ga dihamo</h1>
        <span className="points">⭐ {points}</span>
      </header>

      {error && <p className="error">{error}</p>}

      {tab === 'zdaj' && (
        <>
          <StationSearch readings={readings} value={station} onChange={setStation} />
          {current && <NowCard reading={current} profile={profile} openBet={openBet} onBet={placeBet} />}
          {current && <Alerts reading={current} hours={hours12} profile={profile} notify={notify} />}
          {current && fc && <Forecast12h fc={fc} hours={hours12} />}
          {current && fc && <History fc={fc} from={current.from} measured={obs[current.code] ?? {}} />}
        </>
      )}

      {tab === 'igra' && (
        <>
          <Game
            bets={bets}
            stationName={current?.name ?? station}
            openBet={openBet}
            onBet={placeBet}
            nickname={nickname}
            onDemoResolve={DEMO ? demoResolve : undefined}
          />
          <League cetrt={cetrt} onCetrt={setCetrt} weekPoints={weekPoints} />
        </>
      )}

      {tab === 'dan' && (
        <>
          <DayRing
            rings={[
              { label: 'Dom', code: home },
              { label: 'Služba', code: work },
            ].map(({ label, code }) => ({
              label,
              station: readings.find((r) => r.code === code)?.name ?? code,
              hours: forecasts[code] ? ofDay(forecasts[code], dateStr(new Date())) : [],
            }))}
          />
          <Places readings={readings} home={home} work={work} onHome={setHome} onWork={setWork} />
        </>
      )}

      {tab === 'jaz' && <Me profile={profile} onProfile={setProfile} notify={notify} onNotify={setNotify} />}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setTab(t.key)}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  )
}

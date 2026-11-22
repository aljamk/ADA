import { useEffect, useRef, useState } from 'react'
import { usAqi } from './aqi'
import { distanceKm, fetchArso, inBasin, shortName, type Reading } from './arso'
import { cetrtOfStation, loadCetrti, stationOfCetrt, type Cetrt } from './cetrti'
import { Golob2D } from './components/Golob'
import StationPicker from './components/StationPicker'
import TabBar, { TABS, type TabKey } from './components/TabBar'
import { fetchForecast, next12, type Forecast, type ForecastHour } from './forecast'
import type { GameLog } from './game'
import { onResume, syncWidget } from './native'
import { thresholdAqi, type ProfileKey } from './profile'
import Cetrti from './screens/Cetrti'
import Naloge from './screens/naloge/Naloge'
import Odlocevalci, { publicNoticeWindow } from './screens/Odlocevalci'
import Onboarding from './screens/Onboarding'
import Opozorila, { DEFAULT_ALERTS, type AlertSettings } from './screens/Opozorila'
import Zdaj from './screens/Zdaj'
import Zemljevid, { MAP_STATIONS } from './screens/Zemljevid'
import { load, save } from './storage'
import { dateStr, hh } from './time'

/** Small hook: state that is persisted to localStorage */
function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => load(key, init))
  useEffect(() => save(key, v), [key, v])
  return [v, setV] as const
}

/** Show a system notification at most once per key per day (only while the app is open; no push server). */
function notifyOnce(key: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const id = `${dateStr(new Date())}|${key}`
  if (load('lastNotified_' + key, '') === id) return
  new Notification('Zrak', { body, icon: '/icon.svg' })
  save('lastNotified_' + key, id)
}

const inRange = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to)

function checkAlerts(s: AlertSettings, hours: ForecastHour[], fc: Forecast | undefined, profile: ProfileKey) {
  const now = new Date().getHours()
  if (inRange(now, s.quietFrom, s.quietTo)) return
  if (s.airing && inRange(now, s.airingFrom, s.airingTo) && hours.length >= 3) {
    // Best 3-hour window starting in the next hour → time to air out
    const first3 = hours.slice(0, 3)
    const avg = first3.reduce((a, h) => a + h.value, 0) / 3
    const better = hours.slice(3).every((h) => h.value >= avg)
    if (better && usAqi(avg) <= thresholdAqi(profile))
      notifyOnce('airing', `Zdaj je dober čas za zračenje, do ${(Number(hh(first3[2].time)) + 1) % 24}h.`)
  }
  if (s.eveningBefore && now >= s.eveningAt && now < s.eveningAt + 3) {
    const w = publicNoticeWindow(fc)
    if (w) notifyOnce('evening', `Jutri bo zrak slab med ${w}. Načrtuj sprehod izven teh ur.`)
  }
}

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({})
  const requested = useRef(new Set<string>())
  // Deep links: #zdaj, #zemljevid, #model (map in model mode), #igra, #cetrti, #ugani (straight into a round), #opozorila, #odlocevalci
  const hash = location.hash.slice(1)
  const [tab, setTab] = useState<TabKey>(hash === 'ugani' ? 'igra' : hash === 'model' ? 'zemljevid' : TABS.some((t) => t.key === hash) ? (hash as TabKey) : 'zdaj')
  const [overlay, setOverlay] = useState<'odlocevalci' | 'picker' | null>(hash === 'odlocevalci' ? 'odlocevalci' : null)
  const [distance, setDistance] = useState<number>()
  // Splash: Golob greets on every open, briefly (shorter with reduced motion)
  const [splash, setSplash] = useState<'in' | 'out' | null>('in')
  useEffect(() => {
    const quick = matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = setTimeout(() => setSplash('out'), quick ? 300 : 1300)
    const b = setTimeout(() => setSplash(null), quick ? 500 : 1700)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  const [onboarded, setOnboarded] = useStored('onboarded', false)
  const [profile, setProfile] = useStored<ProfileKey>('profile', 'nihce')
  const [station, setStation] = useStored('station', 'E403') // LJ Bežigrad
  const [log] = useStored<GameLog>('ugani', {})
  const [alerts, setAlerts] = useStored<AlertSettings>('alerts', DEFAULT_ALERTS)
  const [mine, setMine] = useStored<string[]>('mojePostaje', ['E403']) // model view on the map: home, work, …
  // Your četrt: chosen on the Četrti tab, or the one nearest to the station chosen on Zdaj. The two stay linked.
  const [cetrti, setCetrti] = useState<Cetrt[]>([])
  const [cetrt, setCetrt] = useStored<string | null>('cetrt', null)
  useEffect(() => {
    loadCetrti().then(setCetrti)
  }, [])
  const [pickFor, setPickFor] = useState<'zdaj' | 'zemljevid'>('zdaj')

  // ARSO on start, on resume and every 15 minutes (feed updates ~45 min past the hour)
  useEffect(() => {
    const get = () =>
      fetchArso()
        .then((rs) => {
          setReadings(rs)
          setForecasts({})
          requested.current.clear()
          setError(null)
        })
        .catch((e) => setError(`Napaka pri branju ARSO: ${e}`))
    const stop = onResume(get)
    const id = setInterval(get, 15 * 60000)
    return () => {
      stop()
      clearInterval(id)
    }
  }, [])

  // Model forecast for the chosen station, my map stations and the three map stations
  useEffect(() => {
    for (const code of new Set([station, ...mine, ...MAP_STATIONS.map((s) => s.code)])) {
      const r = readings.find((x) => x.code === code)
      if (!r || forecasts[code] || requested.current.has(code)) continue
      requested.current.add(code)
      fetchForecast(r)
        .then((fc) => setForecasts((f) => ({ ...f, [code]: fc })))
        .catch((e) => setError(`Napoved ni na voljo: ${e}`))
    }
  }, [readings, station, mine, forecasts])

  const current = readings.find((r) => r.code === station)
  const myCetrt = cetrt ?? (current ? cetrtOfStation(cetrti, current) : null)

  // Picking a četrt on the Četrti tab also moves Zdaj to the nearest station that measures PM2.5
  const pickCetrt = (name: string) => {
    setCetrt(name)
    const c = cetrti.find((x) => x.ime === name)
    const code = c && stationOfCetrt(readings, c)
    if (code) setStation(code)
  }
  const fc = forecasts[station]
  const hours12 = current && fc ? next12(fc, current.from) : []

  useEffect(() => {
    syncWidget({ station, stationName: current ? shortName(current.name) : '' })
  }, [station, current])

  useEffect(() => {
    if (current && fc) checkAlerts(alerts, hours12, fc, profile)
  }, [alerts, current, fc, hours12, profile])

  // Distance is shown only if the user chose "use my location" in the picker (one-time, not stored)
  const pickStation = (code: string, at?: { lat: number; lon: number }) => {
    setOverlay(null)
    if (pickFor === 'zemljevid') {
      if (!mine.includes(code)) setMine([...mine, code])
      return
    }
    setStation(code)
    const r = readings.find((x) => x.code === code)
    setDistance(at && r ? distanceKm(at.lat, at.lon, r.lat, r.lon) : undefined)
    // Picking a station on Zdaj also moves your četrt to the nearest one
    if (r) setCetrt(cetrtOfStation(cetrti, r))
  }


  // ?intro=0 skips the welcome screen (demos and screenshots)
  if (!onboarded && new URLSearchParams(location.search).get('intro') !== '0')
    return (
      <div className="app">
        <Onboarding
          onDone={(p) => {
            setProfile(p)
            setOnboarded(true)
          }}
        />
      </div>
    )

  return (
    <div className="app">
      {splash && (
        <div className={`splash ${splash}`} aria-hidden="true">
          <Golob2D size={150} className="splash-golob" />
          <p className="splash-name">Zrak</p>
          <p className="splash-line">Veš, kaj dihaš.</p>
        </div>
      )}
      {error && <p className="error" style={{ padding: '12px 24px 0' }}>{error}</p>}

      {overlay === 'odlocevalci' ? (
        <Odlocevalci fc={forecasts.E403} onBack={() => setOverlay(null)} />
      ) : (
        <>
          {tab === 'zdaj' &&
            (current ? (
              <Zdaj
                reading={current}
                hours={hours12}
                profile={profile}
                distance={distance}
                cetrt={myCetrt}
                onStation={() => { setPickFor('zdaj'); setOverlay('picker') }}
                onDecisionMakers={() => setOverlay('odlocevalci')}
              />
            ) : (
              <div className="screen"><p className="t-title">Zdaj</p><p className="t-body t-2">Nalagam meritve ARSO…</p></div>
            ))}
          {tab === 'zemljevid' && (
            <Zemljevid readings={readings} forecasts={forecasts} station={station} mine={mine} onMine={setMine} onAddStation={() => { setPickFor('zemljevid'); setOverlay('picker') }} initialMode={hash === 'model' ? 'model' : 'meritev'} />
          )}
          {tab === 'igra' && <Naloge reading={current} fc={fc} profile={profile} log={log} />}
          {tab === 'cetrti' && <Cetrti readings={readings} cetrti={cetrti} mine={myCetrt} station={station} onPick={pickCetrt} />}
          {tab === 'opozorila' && (
            <Opozorila settings={alerts} onChange={setAlerts} stationName={current ? shortName(current.name) : 'tvojo postajo'} />
          )}
        </>
      )}

      {overlay === 'picker' && (
        <StationPicker readings={readings.filter(inBasin)} value={station} onPick={pickStation} onClose={() => setOverlay(null)} />
      )}

      <TabBar
        tab={tab}
        onTab={(t) => {
          setOverlay(null)
          setTab(t)
        }}
      />
    </div>
  )
}

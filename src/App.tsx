import { useEffect, useRef, useState } from 'react'
import { usAqi } from './aqi'
import { distanceKm, fetchArso, inBasin, shortName, type Reading } from './arso'
import { arsoFor, loadCetrti, sourceFor, type Cetrt } from './cetrti'
import { fetchCitizen } from './sensors'
import { Golob2D } from './components/Golob'
import CetrtPicker from './components/CetrtPicker'
import StationPicker from './components/StationPicker'
import TabBar, { TABS, type TabKey } from './components/TabBar'
import { fetchForecast, next12, next24, type Forecast, type ForecastHour } from './forecast'
import type { GameLog } from './game'
import { isNative, onResume, syncWidget } from './native'
import { primaryProfile, thresholdAqi, type ProfileKey } from './profile'
import Cetrti from './screens/Cetrti'
import Naloge from './screens/naloge/Naloge'
import Odlocevalci, { publicNoticeWindow } from './screens/Odlocevalci'
import Onboarding from './screens/Onboarding'
import Opozorila, { DEFAULT_ALERTS, type AlertSettings } from './screens/Opozorila'
import Zdaj from './screens/Zdaj'
import Zemljevid, { MAP_STATIONS } from './screens/Zemljevid'
import { load, save } from './storage'
import { dateStr, hh } from './time'
import { cancelPlan, planAt, showNow, type NotifKey } from './obvestila'

/** Small hook: state that is persisted to localStorage */
function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => load(key, init))
  useEffect(() => save(key, v), [key, v])
  return [v, setV] as const
}

/** Web: show a notification at most once per key per day (only while the page is open). */
function notifyOnce(key: NotifKey, body: string) {
  const id = `${dateStr(new Date())}|${key}`
  if (load('lastNotified_' + key, '') === id) return
  showNow(key, body)
  save('lastNotified_' + key, id)
}

const SEASONS = {
  heating: { m: 10, d: 15, body: 'Začela se je kurilna sezona. Zvečer, ko sosedje zakurijo, je delcev tudi dvakrat več: zrači čez dan, sprehod načrtuj pred 20h.' },
  tourist: { m: 6, d: 1, body: 'Začela se je turistična sezona. V središču je več prometa; za sprehod raje izberi park ali obrobje.' },
} as const

/** A notification once per season per year: inside the season's first week (web), or planned for its first day at 9h (Android) */
function notifySeason(key: 'heating' | 'tourist') {
  const { m, d, body } = SEASONS[key]
  const now = new Date()
  const y = now.getFullYear()
  const start = new Date(y, m - 1, d, 9)
  if (isNative) {
    // the next season start that is still ahead
    const at = start.getTime() > now.getTime() ? start : new Date(y + 1, m - 1, d, 9)
    planAt(key, at, body)
    return
  }
  const days = (now.getTime() - start.getTime()) / 86400000
  if (days < -0.4 || days > 7) return
  if (load('season_' + key, '') === String(y)) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  showNow(key, body)
  save('season_' + key, String(y))
}

const inRange = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to)
/** "2026-11-21 16:00" -> local Date */
const toDate = (t: string) => new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)), Number(t.slice(11, 13)))

function checkAlerts(s: AlertSettings, hours: ForecastHour[], hours24: ForecastHour[], fc: Forecast | undefined, profile: ProfileKey) {
  if (s.heating) notifySeason('heating')
  else cancelPlan('heating')
  if (s.tourist) notifySeason('tourist')
  else cancelPlan('tourist')

  if (isNative) {
    // Android: plan today's notifications ahead, so they arrive with the app closed
    const today = dateStr(new Date())
    if (s.airing) {
      // the cleanest 3-hour window later today that starts inside the airing hours and outside the quiet hours
      let best: { at: Date; avg: number; until: number } | null = null
      for (let i = 0; i + 3 <= hours24.length; i++) {
        const t = hours24[i].time
        const h = Number(hh(t))
        if (t.slice(0, 10) !== today || !inRange(h, s.airingFrom, s.airingTo) || inRange(h, s.quietFrom, s.quietTo)) continue
        const avg = hours24.slice(i, i + 3).reduce((a, x) => a + x.value, 0) / 3
        if (usAqi(avg) <= thresholdAqi(profile) && (!best || avg < best.avg)) best = { at: toDate(t), avg, until: (h + 3) % 24 }
      }
      if (best) planAt('airing', best.at, `Zdaj je dober čas za zračenje, do ${best.until}h.`)
      else cancelPlan('airing')
    } else cancelPlan('airing')
    const w = s.eveningBefore && !inRange(s.eveningAt, s.quietFrom, s.quietTo) ? publicNoticeWindow(fc) : null
    if (w) planAt('evening', new Date(new Date().setHours(s.eveningAt, 0, 0, 0)), `Jutri bo zrak slab med ${w}. Načrtuj sprehod izven teh ur.`)
    else cancelPlan('evening')
    return
  }

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
  const [citizen, setCitizen] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({})
  const requested = useRef(new Set<string>())
  // Deep links: #zdaj, #postaja (Zdaj with the station picker open), #zemljevid, #model (map), #meritve (map on measurements), #igra, #cetrti, #ugani (straight into a round), #opozorila, #odlocevalci
  const hash = location.hash.slice(1)
  const [tab, setTab] = useState<TabKey>(hash === 'ugani' ? 'igra' : hash === 'model' || hash === 'meritve' ? 'zemljevid' : hash === 'postaja' ? 'zdaj' : TABS.some((t) => t.key === hash) ? (hash as TabKey) : 'zdaj')
  const [overlay, setOverlay] = useState<'odlocevalci' | 'picker' | null>(hash === 'odlocevalci' ? 'odlocevalci' : hash === 'postaja' ? 'picker' : null)
  const [distance, setDistance] = useState<number>()
  // Splash: Golob greets on every open, briefly (shorter with reduced motion)
  const [splash, setSplash] = useState<'in' | 'out' | null>('in')
  useEffect(() => {
    const quick = matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = setTimeout(() => setSplash('out'), quick ? 300 : 5000)
    const b = setTimeout(() => setSplash(null), quick ? 500 : 5400)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  // The welcome screen (who are the advice for?) opens on the first launch; later "Spremeni" on Zdaj reopens it
  const [onboarded, setOnboarded] = useStored('onboarded', false)
  const [intro, setIntro] = useState(false)
  const [profile, setProfile] = useStored<ProfileKey>('profile', 'nihce') // the most sensitive chosen group
  const [profiles, setProfiles] = useStored<ProfileKey[]>('profiles', []) // every chosen group, for the advice card
  const groups = profiles.length ? profiles : [profile]
  const [log] = useStored<GameLog>('ugani', {})
  const [alerts, setAlerts] = useStored<AlertSettings>('alerts', DEFAULT_ALERTS)
  // Extra stations for the map's "Moje postaje" (work, …). The first one is always the station behind the četrt chosen on Zdaj.
  const [extra, setExtra] = useStored<string[]>('mojePostaje', [])
  // Your četrt, chosen on Zdaj (the only place to choose a location), used across the app.
  // The station or sensor that stands for it is derived: the nearest official one, or a clearly closer citizen sensor.
  const [cetrti, setCetrti] = useState<Cetrt[]>([])
  const [cetrt, setCetrt] = useStored('cetrt', 'Bežigrad')
  useEffect(() => {
    loadCetrti().then(setCetrti)
  }, [])
  const [pickFor, setPickFor] = useState<'zdaj' | 'zemljevid'>('zdaj')

  // ARSO on start, on resume and every 15 minutes (feed updates ~45 min past the hour)
  useEffect(() => {
    const get = () => {
      fetchArso()
        .then((rs) => {
          setReadings(rs)
          setForecasts({})
          requested.current.clear()
          setError(null)
        })
        .catch((e) => setError(`Napaka pri branju ARSO: ${e}`))
      // Citizen sensors are a bonus: if they fail, the app works with ARSO alone
      fetchCitizen().then(setCitizen).catch(() => {})
    }
    const stop = onResume(get)
    const id = setInterval(get, 15 * 60000)
    return () => {
      stop()
      clearInterval(id)
    }
  }, [])

  const all = [...readings, ...citizen]
  const myCetrt = cetrti.find((c) => c.ime === cetrt) ?? cetrti[0] ?? null
  const current = myCetrt ? sourceFor(myCetrt, all) ?? undefined : undefined
  const station = current?.code ?? 'E403'
  const mine = [station, ...extra.filter((c) => c !== station)]
  const setMine = (codes: string[]) => setExtra(codes.filter((c) => c !== station))

  // Model forecast for the chosen source, my map stations and the three map stations
  useEffect(() => {
    for (const code of new Set([station, ...mine, ...MAP_STATIONS.map((s) => s.code)])) {
      const r = [...readings, ...citizen].find((x) => x.code === code)
      if (!r || forecasts[code] || requested.current.has(code)) continue
      requested.current.add(code)
      fetchForecast(r)
        .then((fc) => setForecasts((f) => ({ ...f, [code]: fc })))
        .catch((e) => setError(`Napoved ni na voljo: ${e}`))
    }
  }, [readings, citizen, station, extra, forecasts])

  const fc = forecasts[station]
  const hours12 = current && fc ? next12(fc, current.from) : []
const hours24 = current && fc ? next24(fc, current.from) : []

  // The widget reads ARSO itself, so it always gets the nearest official station to your četrt
  useEffect(() => {
    const w = myCetrt ? arsoFor(myCetrt, readings) : null
    syncWidget({ station: w?.code ?? 'E403', stationName: w ? shortName(w.name) : '' })
  }, [myCetrt, readings])

  useEffect(() => {
    if (current && fc) checkAlerts(alerts, hours12, hours24, fc, profile)
  }, [alerts, current, fc, hours12, hours24, profile])

  // Zdaj: choose your četrt. Distance is shown only if the user chose "use my location" (one-time, not stored)
  const pickCetrt = (name: string, at?: { lat: number; lon: number }) => {
    setOverlay(null)
    setCetrt(name)
    const c = cetrti.find((x) => x.ime === name)
    const src = c ? sourceFor(c, all) : null
    setDistance(at && src ? distanceKm(at.lat, at.lon, src.lat, src.lon) : undefined)
  }
  // Map: add a station or sensor to "my stations"
  const addStation = (code: string) => {
    setOverlay(null)
    if (!mine.includes(code)) setMine([...mine, code])
  }


  const splashEl = splash && (
    <div className={`splash ${splash}`} aria-hidden="true">
      <Golob2D size={150} className="splash-golob" />
      <p className="splash-name">Kaj dihaš?</p>
      <p className="splash-line">Zrak v Ljubljani. Veš, kdaj ven.</p>
    </div>
  )

  // ?intro=0 skips the welcome screen (demos and screenshots)
  if ((!onboarded || intro) && new URLSearchParams(location.search).get('intro') !== '0')
    return (
      <div className="app">
        {splashEl}
        <Onboarding
          initial={groups}
          onDone={(keys) => {
            setProfiles(keys)
            setProfile(primaryProfile(keys))
            setOnboarded(true)
            setIntro(false)
          }}
        />
      </div>
    )

  return (
    <div className="app">
      {splashEl}
      {error && <p className="error" style={{ padding: '12px 24px 0' }}>{error}</p>}

      {overlay === 'odlocevalci' ? (
        <Odlocevalci fc={forecasts.E403} cetrt={myCetrt?.ime ?? null} onBack={() => setOverlay(null)} />
      ) : (
        <>
          {tab === 'zdaj' &&
            (current ? (
              <Zdaj
                reading={current}
                hours={hours24}
                profiles={groups}
                distance={distance}
                cetrt={myCetrt?.ime ?? null}
                sourceKm={current && myCetrt ? distanceKm(current.lat, current.lon, myCetrt.lat, myCetrt.lon) : undefined}
                onStation={() => { setPickFor('zdaj'); setOverlay('picker') }}
                onProfiles={() => setIntro(true)}
                onDecisionMakers={() => setOverlay('odlocevalci')}
              />
            ) : (
              <div className="screen"><p className="t-title">Zdaj</p><p className="t-body t-2">Nalagam meritve ARSO…</p></div>
            ))}
          {tab === 'zemljevid' && (
            <Zemljevid readings={all} forecasts={forecasts} station={station} mine={mine} onMine={setMine} onAddStation={() => { setPickFor('zemljevid'); setOverlay('picker') }} initialMode={hash === 'meritve' ? 'meritev' : 'model'} cetrt={myCetrt?.ime ?? null} />
          )}
          {tab === 'igra' && <Naloge reading={current} fc={fc} profile={profile} log={log} />}
          {tab === 'cetrti' && <Cetrti readings={readings} cetrti={cetrti} mine={myCetrt?.ime ?? null} station={station} />}
          {tab === 'opozorila' && (
            <Opozorila settings={alerts} onChange={setAlerts} stationName={current ? shortName(current.name) : 'tvojo postajo'} />
          )}
        </>
      )}

      {overlay === 'picker' && (
        (pickFor === 'zdaj' ? (
          <CetrtPicker cetrti={cetrti} readings={all} value={myCetrt?.ime ?? null} onPick={pickCetrt} onClose={() => setOverlay(null)} />
        ) : (
          <StationPicker readings={all.filter(inBasin)} value={station} onPick={addStation} onClose={() => setOverlay(null)} />
        ))
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

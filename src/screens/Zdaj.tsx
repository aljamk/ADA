import { useEffect, useState } from 'react'
import { levelOfAqi, usAqi, type LevelKey } from '../aqi'
import Lestvica from '../components/Lestvica'
import { GolobRazpolozenje } from '../components/Golob'
import { ARSO_NAMES, shortName, type Reading } from '../arso'
import type { ForecastHour } from '../forecast'
import { adviceFor, airingText, profileOf, type ProfileKey } from '../profile'
import { whyText } from '../zakaj'

interface Props {
  reading: Reading
  hours: ForecastHour[] // next 24 h, calibrated model
  profiles: ProfileKey[] // the groups chosen at onboarding
  distance?: number // km to nearest station, only if the user shared location once
  cetrt?: string | null // your četrt (the only location choice)
  sourceKm?: number // distance from the četrt centre to the source
  onStation: () => void
  onProfiles: () => void // reopen the welcome screen to change the groups
  onDecisionMakers: () => void
}

/** 02 · Zdaj */
const CLOCK = new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', hour: '2-digit', minute: '2-digit' })

/** The current time in Ljubljana, "HH:MM", refreshed every half minute */
function useLjubljanaClock() {
  const [now, setNow] = useState(() => CLOCK.format(new Date()))
  useEffect(() => {
    const id = setInterval(() => setNow(CLOCK.format(new Date())), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** The level word agreeing with "zrak" (masculine), for "AQI 77 · zmeren" */
const LEVEL_M: Record<LevelKey, string> = { dobro: 'dober', zmerno: 'zmeren', slabo: 'slab', zeloslabo: 'zelo slab', nevarno: 'nevaren' }

export default function Zdaj({ reading, hours, profiles, cetrt, sourceKm, onStation, onProfiles, onDecisionMakers }: Props) {
  const pm = reading.pm25
  const aqi = pm != null ? usAqi(pm) : null
  const level = aqi != null ? levelOfAqi(aqi) : null
  const name = shortName(reading.name)
  const ura = `${Number(reading.from.slice(11, 13))}.${reading.from.slice(14, 16)}` // "8.00"
  const km = sourceKm != null ? `, ${sourceKm.toFixed(1).replace('.', ',')} km od središča četrti` : ''
  const ocena = reading.kind === 'OCENA'
  const tag = ocena ? '○ OCENA' : '● MERITEV'
  const [info, setInfo] = useState(false) // plain-language explanation of the numbers, behind the round i
  const clock = useLjubljanaClock()

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <p className="t-label">Ljubljana</p>
          <p className="t-title" style={{ fontSize: 28 }}>Zdaj: kakovost zraka</p>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 14, paddingBottom: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <button className="link" onClick={onDecisionMakers}>
            Za odločevalce ›
          </button>
          <button className="link t-2" style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-2)' }} onClick={onStation}>
            Zamenjaj četrt
          </button>
        </div>
      </div>

      <section className="hero">
        <div className="now-top">
          <span style={{ fontSize: 17, fontWeight: 500 }}>
            {cetrt ?? name} · {clock}
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="chip">{tag}</span>
            <button className="info-btn on-dark" aria-label="Kaj pomenijo te številke?" aria-expanded={info} onClick={() => setInfo(!info)}>
              i
            </button>
          </span>
        </div>
        {aqi != null && level && pm != null ? (
          <>
            <p className="now-level" style={{ color: level.color }}>
              {level.labelF}
            </p>
            <div className="now-nums">
              <span className="now-aqi">{aqi}</span>
              <span className="now-aqi-unit">AQI</span>
              <span className="now-pm">
                <small>PM2,5 · {ocena ? 'OCENA' : 'MERITEV'}</small>
                <b>{pm} µg/m³</b>
              </span>
            </div>
            <Lestvica aqi={aqi} onDark />
            {info && (
              <div className="now-info">
                <p>
                  <b>AQI {aqi} · {LEVEL_M[level.key]}</b>
                  <br />
                  Ocena zraka od 0 do 500. Do 50 je dober, do 100 zmeren, nad 100 slab. Lestvica US EPA.
                </p>
                <p>
                  <b>PM2,5: {pm} µg/m³</b>
                  <br />
                  Drobni delci, ki pridejo globoko v pljuča. WHO priporoča največ 15 na dan.
                </p>
                <p>
                  <b>{ocena ? 'OCENA' : 'MERITEV'}</b>
                  <br />
                  {ocena
                    ? `Izmeril občanski senzor ${name} ob ${ura}${km}, ne uradna postaja ARSO. ${reading.umerjen && reading.ref ? `Vrednost je popravljena po postaji ${ARSO_NAMES[reading.ref] ?? reading.ref}.` : 'Vrednost ni popravljena.'}`
                    : `Izmerila uradna postaja ARSO ${name} ob ${ura}${km}.`}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="now-level">Ta postaja ne meri PM2,5</p>
        )}
      </section>

      {pm != null && (
        <section className="card-soft">
          <p className="t-h3">{profiles.length > 1 ? 'Nasveti' : 'Nasvet'}</p>
          <ul className="advice">
            {/* Groups with the same advice share one line */}
            {[...new Map(profiles.map((k) => [adviceFor(pm, hours, k), k] as const)).keys()].map((text, i) => (
              <li key={text}>
                <span className="advice-head">
                  <b>{profiles.filter((k) => adviceFor(pm, hours, k) === text).map((k) => (k === 'nihce' ? 'Za vse' : profileOf(k).label)).join(', ')}</b>
                  {i === 0 && <button className="link" style={{ fontSize: 13 }} onClick={onProfiles}>Spremeni</button>}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          {airingText(hours) && <p className="t-body" style={{ marginTop: 12 }}>{airingText(hours)}</p>}
        </section>
      )}

      <section className="card-soft">
        <p className="t-h3">Razlaga</p>
        <p className="t-body" style={{ marginTop: 8 }}>{whyText(pm, hours)}</p>
      </section>

      {level && <GolobRazpolozenje level={(new URLSearchParams(location.search).get('golob') as LevelKey | null) ?? level.key} />}
    </div>
  )
}

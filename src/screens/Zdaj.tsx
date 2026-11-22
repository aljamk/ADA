import { useEffect, useState } from 'react'
import { calibrationNote } from '../sensors'
import { levelOfAqi, levelOfPm, usAqi } from '../aqi'
import Lestvica from '../components/Lestvica'
import { shortName, type Reading } from '../arso'
import type { ForecastHour } from '../forecast'
import { adviceFor, type ProfileKey } from '../profile'
import { hh } from '../time'

interface Props {
  reading: Reading
  hours: ForecastHour[] // next 12 h, calibrated model
  profile: ProfileKey
  distance?: number // km to nearest station, only if the user shared location once
  cetrt?: string | null // your četrt (the only location choice)
  sourceKm?: number // distance from the četrt centre to the source
  onStation: () => void
  onDecisionMakers: () => void
}

/** Lowest 3-hour window while people are awake (7–22h) and highest 3-hour window in the forecast */
function windows(hours: ForecastHour[]) {
  const avg = (i: number) => (hours[i].value + hours[i + 1].value + hours[i + 2].value) / 3
  const awake = (i: number) => {
    const h = Number(hh(hours[i].time))
    return h >= 7 && h <= 19
  }
  let best = -1
  let peak = 0
  for (let i = 0; i + 2 < hours.length; i++) {
    if (awake(i) && (best < 0 || avg(i) < avg(best))) best = i
    if (avg(i) > avg(peak)) peak = i
  }
  return { best, peak, peakAqi: hours.length > 2 ? usAqi(avg(peak)) : 0 }
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

export default function Zdaj({ reading, hours, profile, distance, cetrt, sourceKm, onStation, onDecisionMakers }: Props) {
  const pm = reading.pm25
  const aqi = pm != null ? usAqi(pm) : null
  const level = aqi != null ? levelOfAqi(aqi) : null
  const w = hours.length >= 3 ? windows(hours) : null
  const max = Math.max(1, ...hours.map((h) => h.value))
  const winter = [11, 12, 1, 2, 3].includes(new Date().getMonth() + 1)
  const name = shortName(reading.name)
  const ocena = reading.kind === 'OCENA'
  const tag = ocena ? '○ OCENA' : '● MERITEV'
  const [info, setInfo] = useState(false) // plain-language explanation of the numbers, behind the round i
  const clock = useLjubljanaClock()

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <p className="t-label">{cetrt ? `Ljubljana · ${cetrt}` : 'Ljubljana'}</p>
          <p className="t-title">Zdaj</p>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 14, paddingBottom: 6 }}>
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
              {level.symbol} {level.label}
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
                  <b>AQI {aqi}</b> je indeks kakovosti zraka od 0 do 500. Do 50 je zrak dober, do 100 zmeren, do 150 slab za občutljive, do 200 slab za vse, nad 200 nevaren. Lestvica US EPA.
                </p>
                <p>
                  <b>PM2,5 = {pm} µg/m³</b> so fini delci, manjši od 2,5 tisočinke milimetra (30-krat tanjši od lasu), ki pridejo globoko v pljuča. Številka pove, koliko milijonink grama delcev je v enem kubičnem metru zraka. Priporočilo WHO za en dan je do 15 µg/m³.
                </p>
                <p>
                  {ocena
                    ? <><b>OCENA</b> pomeni, da vrednost prihaja z občanskega senzorja (Sensor.Community) ob {reading.from.slice(11)}, ne z uradne postaje. {reading.umerjen ? <>Senzor je pokazal {reading.raw} µg/m³; vrednost je umerjena na postajo ARSO ({calibrationNote(reading)}) s koeficienti iz podatkovnega paketa, izračunanimi iz treh zim meritev.</> : <>Cenovno ugoden senzor ni umerjen in lahko kaže precej drugače kot uradna postaja.</>} Za uradno vrednost izberi četrt s postajo ARSO.</>
                    : <><b>MERITEV</b> pomeni, da je vrednost izmerila uradna postaja ARSO {name} ob {reading.from.slice(11)}. Ni ocena in ni napoved.</>}
                </p>
              </div>
            )}
            <p className="now-advice">{adviceFor(pm, hours, profile)}</p>
          </>
        ) : (
          <p className="now-level">Ta postaja ne meri PM2,5</p>
        )}
        <div className="now-foot">
          <span>
            Vir: {ocena ? `občanski senzor ${name}, ${calibrationNote(reading)}` : `postaja ARSO ${name}`}, meritev ob {reading.from.slice(11)}{sourceKm != null ? `, ${sourceKm.toFixed(1).replace('.', ',')} km od središča četrti` : ''}
            {distance != null && `, ${distance.toFixed(1).replace('.', ',')} km`}
          </span>
          <span style={{ color: 'var(--hero-text-2)' }}>AQI: lestvica US EPA</span>
        </div>
      </section>

      {w && (
        <>
          <div className="section-head">
            <p className="t-sub">Naslednjih 12 ur</p>
            <span className="chip model">MODEL</span>
          </div>
          <section className="card fc">
            <p className="fc-title">
              {w.best >= 0
                ? `✓ Prezračuj med ${Number(hh(hours[w.best].time))}h in ${(Number(hh(hours[w.best + 2].time)) + 1) % 24}h`
                : 'Zračenje: počakaj do jutra'}
            </p>
            {/* One column per hour: the value on top, a bar coloured by its level, the hour below.
                The airing window and the evening peak are bands behind exactly those columns. */}
            <div className="fc-grid" role="img" aria-label={hours.map((h) => `${hh(h.time)}h ${h.value} µg/m³ ${levelOfPm(h.value).label}`).join(', ')}>
              {w.best >= 0 && (
                <div className="fc-band good" style={{ gridColumn: `${w.best + 1} / span 3` }}>
                  <span>Prezračuj</span>
                </div>
              )}
              {w.peakAqi > 50 && w.peak !== w.best && (
                <div className="fc-band peak" style={{ gridColumn: `${w.peak + 1} / span 3` }}>
                  <span>Vrh</span>
                </div>
              )}
              {hours.map((h, i) => {
                const lvl = levelOfPm(h.value)
                return (
                  <div key={h.time} className="fc-col" style={{ gridColumn: i + 1 }} title={`${hh(h.time)}h: ~${h.value} µg/m³ (${lvl.label})`}>
                    <span className="fc-val" style={{ color: lvl.color }}>{h.value}</span>
                    <span className="fc-bar" style={{ height: `${Math.max(10, (h.value / max) * 100)}%`, background: lvl.color }} />
                    <span className="fc-hour">{hh(h.time)}</span>
                  </div>
                )
              })}
            </div>
            <div className="fc-legend">
              <span>µg/m³ PM2,5 na uro</span>
              <span>
                {(['Dobro', 'Zmerno', 'Slabo'] as const).map((l) => {
                  const lv = [levelOfPm(5), levelOfPm(20), levelOfPm(40)].find((x) => x.label === l)!
                  return <i key={l}><b style={{ background: lv.color }} />{l}</i>
                })}
              </span>
            </div>
          </section>
        </>
      )}

      <section className="card-soft">
        <p className="t-h3">Zakaj?</p>
        <p className="t-body" style={{ marginTop: 8 }}>
          {winter
            ? 'Pozimi inverzija zadržuje delce v kotlini. Zvečer jih dodata ogrevanje in promet.'
            : 'Izven kurilne sezone se zrak bolje meša in delci se hitreje razredčijo.'}
        </p>
      </section>
    </div>
  )
}

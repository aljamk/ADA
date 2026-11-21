import { useEffect } from 'react'
import { levelOf, type Reading } from '../arso'
import type { ForecastHour } from '../forecast'
import { adviceFor, profileOf, type ProfileKey } from '../profile'
import { load, save } from '../storage'
import { dateStr, hh } from '../time'

interface Props {
  reading: Reading
  hours: ForecastHour[] // next 12 h, calibrated model
  profile: ProfileKey
  notify: boolean
}

export function alertFor(reading: Reading, hours: ForecastHour[], profile: ProfileKey) {
  const p = profileOf(profile)
  if (reading.pm25 != null && reading.pm25 >= p.threshold)
    return { warn: true, text: `Zdaj ${reading.pm25} µg/m³. ${adviceFor(reading.pm25, profile)}` }
  const first = hours.find((h) => h.value >= p.threshold)
  if (first)
    return {
      warn: true,
      text: `Od ${hh(first.time)}h bo ~${first.value} µg/m³ (${levelOf(first.value).label.toLowerCase()}). Sprehod in zračenje raje pred ${hh(first.time)}h.`,
    }
  return { warn: false, text: `V naslednjih 12 urah ne pričakujemo preseganja praga za profil »${p.label}«.` }
}

/** Smart alert card. With notifications on, also shows a system notification (max once per alert per day). */
export default function Alerts({ reading, hours, profile, notify }: Props) {
  const a = alertFor(reading, hours, profile)

  useEffect(() => {
    if (!a.warn || !notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const key = `${dateStr(new Date())}|${a.text.slice(0, 12)}`
    if (load('lastNotified', '') === key) return
    new Notification('Zrak, ki ga dihamo', { body: a.text, icon: '/icon.svg' })
    save('lastNotified', key)
  }, [a.warn, a.text, notify])

  return (
    <section className={`card alert ${a.warn ? 'warn' : 'ok'}`}>
      <span className="alert-icon">{a.warn ? '⚠️' : '✅'}</span>
      <div>
        <b>{profileOf(profile).emoji} {profileOf(profile).label}</b>
        <p>{a.text}</p>
        <div className="tag muted">Iz meritve ARSO in umerjenega modela CAMS</div>
      </div>
    </section>
  )
}

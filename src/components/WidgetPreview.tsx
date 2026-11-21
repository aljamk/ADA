import { levelOf, type Reading } from '../arso'
import type { ForecastHour } from '../forecast'
import type { Bet, BucketKey } from '../game'
import { hh } from '../time'
import BetButtons from './BetButtons'

interface Props {
  reading: Reading
  hours: ForecastHour[] // next 12 h
  openBet?: Bet
  onBet: (b: BucketKey) => void
}

/**
 * What the native widgets will show, working on live data. Real widgets need native code:
 * iOS WidgetKit (home, lock screen and Apple Watch share it) and Android App Widgets.
 */
export default function WidgetPreview({ reading, hours, openBet, onBet }: Props) {
  const v = reading.pm25
  if (v == null) return null
  const level = levelOf(v)
  const best = hours.length ? hours.reduce((a, b) => (b.value < a.value ? b : a)) : undefined
  const max = Math.max(15, ...hours.map((h) => h.value))
  // Lock-screen gauge: share of the 0–100 µg/m³ range
  const frac = Math.min(1, v / 100)
  const R = 26
  const len = 2 * Math.PI * R

  return (
    <section className="card">
      <h2>Predogled widgetov</h2>
      <p className="muted">Pogled brez odpiranja aplikacije in brez vnosa podatkov.</p>

      <div className="widget-home">
        <div className="wh-top">
          <span>{reading.name}</span>
          <span>
            <span className="dot small" style={{ background: level.color }} /> <b>{v}</b> µg
          </span>
        </div>
        <div className="wh-strip">
          {hours.map((h) => (
            <div key={h.time} style={{ height: `${(h.value / max) * 100}%`, background: levelOf(h.value).color }} />
          ))}
        </div>
        {best && <div className="wh-tip">🪟 Prezrači ob {hh(best.time)}h</div>}
        <div className="wh-bet">
          <span>Jutri 8h?</span>
          <BetButtons openBet={openBet} onBet={onBet} compact />
        </div>
      </div>

      <div className="widget-row">
        <figure>
          <svg viewBox="0 0 64 64" className="widget-lock">
            <circle cx="32" cy="32" r={R} fill="none" stroke="#ffffff33" strokeWidth="6" />
            <circle
              cx="32" cy="32" r={R} fill="none" stroke={level.color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${frac * len} ${len}`} transform="rotate(-90 32 32)"
            />
            <text x="32" y="37" textAnchor="middle">{v}</text>
            {!openBet && <circle cx="52" cy="12" r="5" fill="#FF5050" />}
          </svg>
          <figcaption>Zaklenjen zaslon</figcaption>
        </figure>
        <figure>
          <div className="widget-watch">
            <svg viewBox="0 0 64 64" className="widget-lock">
              <circle cx="32" cy="32" r={R} fill="none" stroke={level.color} strokeWidth="6" />
              <text x="32" y="37" textAnchor="middle">{v}</text>
            </svg>
            <div className="ww-time">{new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <figcaption>Apple Watch</figcaption>
        </figure>
      </div>
      <div className="tag muted">Rdeča pika = jutrišnja napoved še ni oddana.</div>
    </section>
  )
}

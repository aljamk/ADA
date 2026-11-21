import { levelOf, type Reading } from '../arso'
import type { Bet, BucketKey } from '../game'
import { adviceFor, type ProfileKey } from '../profile'
import BetButtons from './BetButtons'

interface Props {
  reading: Reading
  profile: ProfileKey
  openBet?: Bet
  onBet: (b: BucketKey) => void
}

/** The "glance" card: current measurement, what it means for me, and tomorrow's one-tap bet. */
export default function NowCard({ reading, profile, openBet, onBet }: Props) {
  const v = reading.pm25
  return (
    <section className="card now">
      <div className="tag">MERITEV · ARSO · {reading.from}</div>
      {v != null ? (
        <>
          <div className="value">
            <span className="dot" style={{ background: levelOf(v).color }} />
            {v} <small>µg/m³ PM2.5</small>
          </div>
          <div className="level">{levelOf(v).label}</div>
          <p className="sub">{adviceFor(v, profile)}</p>
        </>
      ) : (
        <div className="value">Ta postaja ne meri PM2.5</div>
      )}
      {reading.pm10 != null && <div className="sub">PM10: {reading.pm10} µg/m³</div>}
      <div className="now-bet">
        <span>Jutri ob 8h?</span>
        <BetButtons openBet={openBet} onBet={onBet} compact />
      </div>
    </section>
  )
}

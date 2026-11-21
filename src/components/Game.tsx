import { useState } from 'react'
import { bucketLabel, shareText, streak, type Bet, type BucketKey } from '../game'
import { shortDate } from '../time'
import BetButtons from './BetButtons'

interface Props {
  bets: Bet[]
  stationName: string
  openBet?: Bet
  onBet: (b: BucketKey) => void
  nickname: string
  onDemoResolve?: () => void // only with ?demo=1, for the pitch
}

export default function Game({ bets, stationName, openBet, onBet, nickname, onDemoResolve }: Props) {
  const [copied, setCopied] = useState(false)
  const resolved = bets.filter((b) => b.points !== undefined)
  const points = resolved.reduce((s, b) => s + (b.points ?? 0), 0)
  const me = resolved.filter((b) => b.points).length
  const model = resolved.filter((b) => b.modelCorrect).length

  const share = async () => {
    const text = shareText(bets)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <>
      <section className="card stats">
        <div>
          <b>{nickname}</b>
          <div className="muted">anonimno, brez računa</div>
        </div>
        <div className="stat">⭐ {points}</div>
        <div className="stat">🔥 {streak(bets)}</div>
      </section>

      <section className="card game">
        <h2>Napovej jutri</h2>
        <p>Kakšen bo PM2.5 jutri ob 8h na postaji {stationName}?</p>
        <BetButtons openBet={openBet} onBet={onBet} />
        {openBet && onDemoResolve && (
          <button className="link" onClick={onDemoResolve}>
            🧪 Demo: razreši zdaj z zadnjo meritvijo
          </button>
        )}
      </section>

      <section className="card">
        <h2>Premagaj model</h2>
        <div className="versus">
          <div>
            <span className="big">{me}</span>Ti
          </div>
          <span className="muted">:</span>
          <div>
            <span className="big">{model}</span>Model CAMS
          </div>
        </div>
        <p className="muted">Pravilne kategorije. Napoved modela vidiš šele po razrešitvi.</p>
        <button className="chip active" onClick={share}>
          {copied ? '✔ Kopirano' : '📤 Deli rezultat'}
        </button>
      </section>

      {resolved.length > 0 && (
        <section className="card">
          <h2>Rezultati</h2>
          <ul className="results">
            {[...resolved].reverse().map((b) => (
              <li key={b.station + b.target}>
                <span>{b.points ? '🟩' : '🟥'}</span>
                <span>
                  {shortDate(b.target)} · {b.stationName ?? b.station}
                  <br />
                  <small className="muted">
                    ti: {bucketLabel(b.bucket)} · izmerjeno: {b.actual} µg/m³
                    {b.model != null && ` · model: ${b.model} ${b.modelCorrect ? '✓' : '✗'}`}
                  </small>
                </span>
                <b>{b.points ? '+100' : '0'}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

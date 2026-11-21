import { BUCKETS } from '../arso'
import { bucketLabel, type Bet, type BucketKey } from '../game'

interface Props {
  openBet?: Bet
  onBet: (b: BucketKey) => void
  compact?: boolean
}

/** The three one-tap answers. Used in the game tab, on the "Zdaj" card and in the widget preview. */
export default function BetButtons({ openBet, onBet, compact }: Props) {
  if (openBet)
    return (
      <p className="placed">
        ✔ Tvoja napoved: <b>{bucketLabel(openBet.bucket)}</b>. Razreši se jutri ob ~9:45.
      </p>
    )
  return (
    <div className={compact ? 'buttons compact' : 'buttons'}>
      {BUCKETS.map((b) => (
        <button key={b.key} onClick={() => onBet(b.key)}>
          {b.label}
          {!compact && <small>{b.hint} µg/m³</small>}
        </button>
      ))}
    </div>
  )
}

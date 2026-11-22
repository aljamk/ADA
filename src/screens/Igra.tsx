import { useEffect, useState } from 'react'
import { LEARN, learnLevel } from '../aqi'
import {
  accuracyPoints, badges, dayTotal, dayVerdict, demoLeague, streak, streakBonus,
  verdict, weekPoints, xpProgress, type GameLog, type RoundResult,
} from '../game'
import { dailyRounds, loadRound, roundDate, type Round } from '../rounds'
import { dateStr } from '../time'

// Facts from the challenge brief (ARSO measurements 2016–2026)
const FACTS = [
  'Zvečer ob 21–23h delci pogosto dosežejo vrh.',
  'Pozimi ima Ljubljana inverzijo v 21 % ur.',
  'V desetih zimah je bilo 195 dni nad mejo za PM10.',
  'Najdaljše obdobje slabega zraka je trajalo sedem dni.',
  'Povprečje PM2,5 je 14 µg/m³, meja EU za 2030 je 10.',
]

interface Props {
  log: GameLog
  onRound: (r: RoundResult) => void
  cetrt: string
}

/** 1240 -> "1.240" (sl-SI locale doesn't group 4-digit numbers, Figma does) */
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** 04 · Ugani zrak (hub) → 05 · Tvoja ocena → 06 · Razkritje → 07 · Rezultati */
export default function Igra({ log, onRound, cetrt, startRound, onBack }: Props & { startRound?: boolean; onBack?: () => void }) {
  const today = dateStr(new Date())
  const done = log[today] ?? []
  const [view, setView] = useState<'hub' | 'round' | 'reveal' | 'results'>(startRound && done.length < 5 ? 'round' : 'hub')
  const [last, setLast] = useState<RoundResult | null>(null)

  if (view === 'round')
    return (
      <Guess
        index={done.length}
        streakDays={streak(log) + 1}
        onBack={() => setView('hub')}
        onDone={(r) => {
          onRound(r)
          setLast(r)
          setView('reveal')
        }}
      />
    )
  if (view === 'reveal' && last)
    return <Reveal r={last} index={done.length} streakDays={streak(log) + (done.length >= 5 ? 0 : 1)} onNext={() => setView(done.length >= 5 ? 'results' : 'round')} />
  if (view === 'results') return <Results log={log} cetrt={cetrt} onBack={() => setView('hub')} />

  const xp = xpProgress(log)
  const s = streak(log)

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <p className="t-label">Vsak dan nov pogled</p>
          <p className="t-title">Ugani zrak</p>
        </div>
        {onBack && <button className="link" style={{ fontSize: 14, paddingBottom: 8 }} onClick={onBack}>‹ Igra</button>}
      </div>

      <section className="hero" style={{ display: 'grid', gap: 12 }}>
        <p className="t-label" style={{ color: 'var(--nebo)' }}>
          Dnevni izziv · {Math.min(done.length, 5)} od 5 krogov
        </p>
        <p style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
          {done.length >= 5 ? (
            <>Izziv opravljen.<br />Jutri novi kraji.</>
          ) : done.length ? (
            <>Še en kraj.<br />Kakšen je bil zrak?</>
          ) : (
            <>Pet krajev.<br />Kakšen je bil zrak?</>
          )}
        </p>
        <button className="btn" style={{ background: 'var(--hero-b)', color: 'var(--hero-text)' }} onClick={() => setView(done.length >= 5 ? 'results' : 'round')}>
          {done.length >= 5 ? 'Poglej rezultate  →' : done.length ? `Nadaljuj · ${done.length + 1}. krog  →` : 'Začni · 1. krog  →'}
        </button>
      </section>

      <section className="card streak">
        <img src="/figma/flame.svg" alt="" width={28} height={32} style={{ gridRow: 'span 2' }} />
        <b className="t-body" style={{ fontWeight: 700 }}>{s} {s === 1 ? 'dan' : 'dni'} zapored</b>
        <span className="t-small" style={{ fontWeight: 700 }}>{xp.xp} / {xp.of} XP</span>
        <div className="progress"><div style={{ width: `${(xp.xp / xp.of) * 100}%` }} /></div>
      </section>

    </div>
  )
}

/** 05 · Tvoja ocena */
function Guess({ index, streakDays, onBack, onDone }: { index: number; streakDays: number; onBack: () => void; onDone: (r: RoundResult) => void }) {
  const base = dailyRounds()[index]
  const [round, setRound] = useState<Round>(base)
  const [error, setError] = useState<string | null>(null)
  const [guess, setGuess] = useState(25)

  useEffect(() => {
    loadRound(base).then(setRound).catch((e) => setError(String(e)))
  }, [base.time, base.place.name]) // base is recreated every render; these identify the round

  const confirm = () => {
    if (round.value == null || !round.source) return
    const diff = Math.abs(guess - round.value)
    const accuracy = accuracyPoints(diff)
    const bonus = streakBonus(streakDays)
    onDone({
      place: round.place.name, time: round.time, guess, actual: round.value, source: round.source,
      station: round.place.station, accuracy, streakBonus: bonus, points: accuracy + bonus,
    })
  }

  return (
    <div className="round">
      <div
        className="round-photo"
        style={{ backgroundImage: round.place.photo ? `url(${round.place.photo})` : 'linear-gradient(160deg, var(--hero-b), var(--hero-a) 60%, #0b2027)' }}
      >
        <div className="round-head">
          <button className="link" onClick={onBack}>‹  Ugani zrak</button>
          <span>Krog {index + 1} / 5</span>
        </div>
        <div className="round-steps">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className={i < index ? 'done' : i === index ? 'cur' : ''} />)}
        </div>
        <div className="round-place">
          <h2>{round.place.name}</h2>
          <p style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{roundDate(round.time)}</p>
          <p style={{ fontSize: 12, color: '#d5e7ed', marginTop: 12 }}>
            {round.place.photo ? 'Ponazoritev kraja' : 'Brez fotografije'} · {round.source === 'MERITEV' ? 'meritev ARSO' : 'model CAMS'}
          </p>
        </div>
      </div>
      <div className="round-sheet">
        <p className="t-sub">Koliko delcev PM2,5?</p>
        <div className="guess">
          <b>{guess}</b>
          <span>µg/m³</span>
          <em>○ OCENA · TVOJA</em>
        </div>
        <div className="scale">
          <div className="scale-track">
            {LEARN.map((s) => <div key={s.from} style={{ flex: s.to - s.from, background: s.level.color }} />)}
          </div>
          <img className="scale-knob" src="/figma/slider-handle.svg" alt="" style={{ left: `${guess}%` }} />
          <input type="range" min={0} max={100} value={guess} onChange={(e) => setGuess(Number(e.target.value))} aria-label="Tvoja ocena PM2,5 v µg/m³" />
        </div>
        <div className="scale-ticks">{[0, 25, 50, 75, 100].map((t) => <span key={t}>{t}</span>)}</div>
        <p className="t-small">Učna lestvica · ne zdravstvene meje</p>
        {error && <p className="error">Podatka ni bilo mogoče naložiti: {error}</p>}
        <button className="btn" onClick={confirm} disabled={round.value == null}>
          {round.value == null && !error ? 'Nalagam…' : 'Potrdi oceno'}
        </button>
      </div>
    </div>
  )
}

/** 06 · Razkritje */
function Reveal({ r, index, streakDays, onNext }: { r: RoundResult; index: number; streakDays: number; onNext: () => void }) {
  const diff = Math.abs(r.guess - r.actual)
  const pos = (v: number) => `${Math.min(100, v)}%`
  return (
    <div className="screen" style={{ paddingBottom: 200 }}>
      <div className="screen-head">
        <div>
          <p className="t-label">Ugani zrak · krog {index} / 5</p>
          <p className="t-title">{verdict(diff)}</p>
        </div>
        <span className="t-small" style={{ fontSize: 11, paddingBottom: 8 }}>
          {r.source === 'MERITEV' ? 'Meritev ARSO' : 'Model CAMS'}
        </span>
      </div>
      <section className="card reveal">
        <p className="full t-body" style={{ fontWeight: 700 }}>{r.place} · {roundDate(r.time)}</p>
        <span className="t-body t-2" style={{ marginTop: 14 }}>Tvoja ocena</span>
        <span className="t-body t-2" style={{ marginTop: 14 }}>{r.source === 'MERITEV' ? `ARSO · ${r.station}` : 'Model CAMS'}</span>
        <span className="big">{r.guess}</span>
        <span className="big">{r.actual}</span>
        <span className="t-label">○ Ocena</span>
        <span className="t-label">{r.source === 'MERITEV' ? '● Meritev' : '◇ Model'}</span>
        <span className="t-small">µg/m³ · PM2,5</span>
        <b className="t-body" style={{ fontWeight: 700 }}>{learnLevel(r.actual).symbol} {learnLevel(r.actual).label}</b>
        <div className="full mini-scale">
          <div className="track">{LEARN.map((s) => <div key={s.from} style={{ flex: s.to - s.from, background: s.level.color }} />)}</div>
          <div className="mark" style={{ left: pos(r.guess), top: 0, background: 'var(--accent)' }} title="Tvoja ocena" />
          <div className="mark" style={{ left: pos(r.actual), top: 33, background: 'var(--text)' }} title="Prava vrednost" />
        </div>
        <b className="full t-body" style={{ fontWeight: 700 }}>Razlika: {diff} µg/m³</b>
      </section>
      <p className="t-small">Najbližji senzor: {r.station}</p>
      <section className="points">
        <b>+{r.points}</b>
        <div>
          <span>+{r.accuracy} natančnost</span>
          <span style={{ color: 'var(--nebo)' }}>+{r.streakBonus} niz · {streakDays} {streakDays === 1 ? 'dan' : 'dni'}</span>
        </div>
      </section>
      <section className="card-soft">
        <p className="t-h3">Ali veš?</p>
        <p className="t-body" style={{ marginTop: 8 }}>{FACTS[(index - 1) % FACTS.length]}</p>
      </section>
      <div className="bottom-bar" style={{ bottom: 90, paddingBottom: 12 }}>
        <button className="btn" onClick={onNext}>{index >= 5 ? 'Poglej rezultate  →' : `Naslednji krog  →`}</button>
      </div>
    </div>
  )
}

/** 07 · Rezultati */
function Results({ log, cetrt, onBack }: { log: GameLog; cetrt: string; onBack: () => void }) {
  const rs = log[dateStr(new Date())] ?? []
  const total = dayTotal(rs)
  const perfect = rs.filter((r) => Math.abs(r.guess - r.actual) <= 1).length
  const league = demoLeague(cetrt, weekPoints(log))
  const leagueRank = league.findIndex((l) => l.cetrt === cetrt) + 1
  const s = streak(log)

  const share = async () => {
    const squares = rs.map((r) => (Math.abs(r.guess - r.actual) <= 5 ? '🟩' : Math.abs(r.guess - r.actual) <= 15 ? '🟨' : '🟥')).join('')
    const text = `Zrak / ${fmt(total)} točk / ${cetrt}\n${squares}\nDanes bolje poznam svoj zrak.`
    try {
      if (navigator.share) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <p className="t-label">Ugani zrak · danes</p>
          <p className="t-title">{dayVerdict(rs)}</p>
        </div>
        <button className="link" style={{ fontSize: 14, paddingBottom: 8 }} onClick={onBack}>Nazaj</button>
      </div>
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <p className="t-label" style={{ color: 'var(--nebo)' }}>Dnevni izziv opravljen</p>
        <p style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.25 }}>{fmt(total)}</p>
        <p style={{ fontSize: 17, fontWeight: 500 }}>točk · {rs.length} krogov</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--zmerno)', marginTop: 10 }}>
          {perfect} {perfect === 1 ? 'popoln zadetek' : 'popolnih zadetkov'} · {s} {s === 1 ? 'dan' : 'dni'} zapored
        </p>
        {[[236, 25, -20, 'var(--zmerno)', 8], [272, 54, 23, 'var(--nebo)', 5], [253, 88, -44, 'var(--zmerno)', 8], [294, 122, -10, 'var(--nebo)', 5], [202, 76, 14, 'var(--zmerno)', 8]].map(([x, y, rot, c, w], i) => (
          <span key={i} className="confetti" style={{ left: `${((x as number) / 342) * 100}%`, top: y as number, width: w as number, height: 12, background: c as string, transform: `rotate(${rot}deg)` }} />
        ))}
      </section>
      <section className="card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 12px', alignItems: 'center' }}>
        <b style={{ fontSize: 32 }}>{leagueRank}.</b>
        <span className="t-body" style={{ fontWeight: 500 }}>v ligi · {cetrt}</span>
        <span className="t-small" style={{ gridColumn: 'span 2' }}>od {league.length} četrti · celotna lestvica je v zavihku Liga</span>
      </section>
      <div className="badges">
        {badges(log).map((b) => (
          <div key={b.key} className={b.earned ? 'badge' : 'badge off'} title={b.earned ? 'Osvojeno' : 'Še ne'}>
            <span style={{ whiteSpace: 'pre-line' }}>{b.label}</span>
            <img src={b.icon} alt="" />
          </div>
        ))}
      </div>
      <button className="card-soft" onClick={share} style={{ border: 'none', display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, textAlign: 'left' }}>
        Zrak / {fmt(total)} točk / {cetrt}
        <span style={{ color: 'var(--accent)', fontSize: 22 }}>↗</span>
      </button>
      <button className="btn" style={{ height: 52 }} onClick={share}>Deli rezultat</button>
    </div>
  )
}

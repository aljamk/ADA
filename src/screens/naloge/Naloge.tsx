// Zavihek Igra: rastlina v pljučih + štiri dnevne naloge (Napoved, Kviz, Beseda dneva, Dih) + Ugani zrak.
// Prenešeno iz prototipa (prototipi/igra). Stanje ostane na napravi.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { shortName, type Reading } from '../../arso'
import { atHour, type Forecast } from '../../forecast'
import { totalXp, type GameLog } from '../../game'
import {
  direction, guessPoints, loadGuesses, loadTasks, playStreak, saveGuesses, saveTasks, taskTotalPoints,
  type Guess, type TaskKey, type TaskResult, type TaskLog,
} from '../../naloge'
import { Golob3D } from '../../components/Golob'
import { syncWidget } from '../../native'
import type { ProfileKey } from '../../profile'
import { dateStr, hh, hourStr, tomorrow8 } from '../../time'
import { BREATH, LEVELS, QUIZ, QUIZ_SOURCE, TASKS, WORD_FACTS, WORDS, levelOf, type Level } from './vsebina'
import './naloge.css'

const dayIndex = () => Math.floor(Date.now() / 86400000)
const XP_LEVEL = 500

/* ---------- Small pieces ---------- */
function Tag({ kind, children }: { kind: 'MERITEV' | 'MODEL' | 'OCENA'; children?: ReactNode }) {
  // MERITEV = filled dot, MODEL = dashed outline, OCENA = hollow dot
  return (
    <span className={`tag tag-${kind.toLowerCase()}`}>
      {kind !== 'MODEL' && <span className="tag-dot" aria-hidden="true" />}
      {kind}
      {children && <span className="tag-rest"> · {children}</span>}
    </span>
  )
}

function LevelPill({ pm }: { pm: number }) {
  const l = levelOf(pm)
  return (
    <span className="level-pill">
      <span className="level-ico" style={{ background: l.color }} aria-hidden="true">{l.icon}</span>
      {l.word}
    </span>
  )
}

function Drop({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 20 25" aria-hidden="true">
      <path d="M10 1.5C10 1.5 2 10.5 2 16a8 8 0 0 0 16 0C18 10.5 10 1.5 10 1.5Z" fill={filled ? 'var(--primary)' : 'none'} stroke="var(--primary)" strokeWidth="1.8" />
    </svg>
  )
}

function TaskIcon({ name }: { name: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'forecast' && (<><path {...p} d="M7 17h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 10 3.5 3.5 0 0 0 7 17Z" /><path {...p} d="M12 20v2M8 20l-1 2M16 20l1 2" /></>)}
      {name === 'quiz' && (<><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7M12 17h.01" /></>)}
      {name === 'word' && (<><rect {...p} x="3" y="7" width="5" height="10" rx="1.2" /><rect {...p} x="9.5" y="7" width="5" height="10" rx="1.2" /><rect {...p} x="16" y="7" width="5" height="10" rx="1.2" /></>)}
      {name === 'breath' && (<><path {...p} d="M3 9h11a3 3 0 1 0-3-3" /><path {...p} d="M3 13h15a3 3 0 1 1-3 3" /><path {...p} d="M3 17h6" /></>)}
      {name === 'map' && (<><circle {...p} cx="12" cy="10" r="3" /><path {...p} d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /></>)}
    </svg>
  )
}

/** Plant in the lungs outline. stage 0 = drooping (never dead), 4 = full grown with a flower. */
export function Plant({ stage, size = 200 }: { stage: number; size?: number }) {
  const wilted = stage === 0
  const leaf = wilted ? '#8FA79C' : '#3E9C6B'
  const leafDark = wilted ? '#7A9187' : '#2D7F55'
  const stemTop = [118, 104, 88, 72, 58][Math.min(4, stage)]
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={wilted ? 'Rastlina je žejna' : `Rastlina, stopnja rasti ${stage} od 4`}>
      <path d="M100 30v46M100 76c-8 0-14 6-20 14M100 76c8 0 14 6 20 14" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 66C52 60 30 92 28 128c-2 30 12 46 34 44 20-2 30-14 32-36l2-52c0-10-8-16-18-18Z" fill="var(--lung)" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M122 66c26-6 48 26 50 62 2 30-12 46-34 44-20-2-30-14-32-36l-2-52c0-10 8-16 18-18Z" fill="var(--lung)" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="100" cy="160" rx="30" ry="7" fill="var(--soil)" />
      <path
        d={wilted ? 'M100 158C100 140 102 128 112 122' : `M100 158C100 ${158 - (158 - stemTop) / 2} 100 ${stemTop + 10} 100 ${stemTop}`}
        fill="none" stroke={leafDark} strokeWidth="4" strokeLinecap="round" className="stem"
      />
      {wilted ? (
        <>
          <path d="M112 122c8 2 12 10 10 18-8-2-12-9-10-18Z" fill={leaf} />
          <path d="M101 140c-9-1-15 5-15 13 9 0 15-5 15-13Z" fill={leaf} />
        </>
      ) : (
        <g className="leaves">
          <path d="M100 146c-12-6-24-2-28 8 12 4 22 2 28-8Z" fill={leaf} />
          <path d="M100 146c12-6 24-2 28 8-12 4-22 2-28-8Z" fill={leafDark} />
          {stage >= 2 && (<><path d="M100 122c-12-7-25-3-29 7 12 5 23 3 29-7Z" fill={leaf} /><path d="M100 122c12-7 25-3 29 7-12 5-23 3-29-7Z" fill={leafDark} /></>)}
          {stage >= 3 && (<><path d="M100 98c-11-7-23-4-27 6 11 5 21 3 27-6Z" fill={leaf} /><path d="M100 98c11-7 23-4 27 6-11 5-21 3-27-6Z" fill={leafDark} /></>)}
          {stage >= 4 && (
            <g className="flower">
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse key={r} cx="100" cy={stemTop - 9} rx="5.5" ry="9" fill="var(--accent)" transform={`rotate(${r} 100 ${stemTop})`} />
              ))}
              <circle cx="100" cy={stemTop} r="5" fill="#F2C94C" />
            </g>
          )}
          {stage === 1 && <circle cx="100" cy={stemTop} r="4" fill={leaf} />}
        </g>
      )}
    </svg>
  )
}

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 0.6, rot: Math.random() * 360,
      color: ['#b8d5a4', '#476e57', '#f5f5ed', '#3BB273'][i % 4],
    })),
    [],
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, background: p.color, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  )
}

/** PM2.5 colour scale 0–100 µg/m³ with marks */
function Scale({ marks = [], gap }: { marks?: { label: string; value: number; kind: string }[]; gap?: [number, number] }) {
  return (
    <div className="scale">
      <div className="scale-track">
        {LEVELS.map((l: Level, i) => (
          <div key={l.key} style={{ flex: l.max - (i ? LEVELS[i - 1].max : 0), background: l.color }} />
        ))}
      </div>
      {gap && <div className="scale-gap" style={{ left: `${gap[0]}%`, width: `${gap[1] - gap[0]}%` }} />}
      {marks.map((m) => (
        <div key={m.label} className={`scale-mark ${m.kind}`} style={{ left: `${Math.min(100, m.value)}%` }}>
          <span>{m.label}</span>
        </div>
      ))}
      <div className="scale-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
    </div>
  )
}

function Screen({ title, eyebrow, onBack, children, footer }: { title: string; eyebrow?: string; onBack: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="screen">
      <div className="screen-head">
        <button className="back" onClick={onBack} aria-label="Nazaj na Igro">‹ Igra</button>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      </div>
      <h1 className="h1">{title}</h1>
      <div className="screen-body">{children}</div>
      {footer && <div className="screen-foot">{footer}</div>}
    </div>
  )
}

/* ============================================================================
 * Naloga 1: Napoved (real ARSO measurement + calibrated CAMS model for your station)
 * ========================================================================== */
interface NapovedProps {
  reading?: Reading
  fc?: Forecast
  guesses: Guess[]
  onGuess: (g: Guess) => void
  onSeen: (g: Guess) => void
  onBack: () => void
}

function Napoved({ reading, fc, guesses, onGuess, onSeen, onBack }: NapovedProps) {
  const today = dateStr(new Date())
  const reveal = guesses.find((g) => g.actual != null && !(g as Guess & { seen?: boolean }).seen)
  const mine = guesses.find((g) => g.made === today)
  const [step, setStep] = useState<'reveal' | 'ask' | 'locked'>(reveal ? 'reveal' : mine ? 'locked' : 'ask')
  const [expert, setExpert] = useState(false)
  const [choice, setChoice] = useState<0 | 1 | 2 | null>(null)
  const base = reading?.pm25 ?? null
  const [value, setValue] = useState(base ?? 20)
  const [gapOn, setGapOn] = useState(false)

  useEffect(() => {
    if (step !== 'reveal') return
    const t = setTimeout(() => setGapOn(true), 300)
    return () => clearTimeout(t)
  }, [step])

  if (step === 'reveal' && reveal) {
    const y = reveal
    const actual = y.actual as number
    const guessed = y.choice == null ? y.value : null
    const pts = guessPoints(y)
    const exact = guessed != null && guessed === actual
    const right = y.choice != null && y.choice === direction(y.base, actual)
    return (
      <Screen
        title={exact ? 'Natančno!' : y.choice != null ? (right ? 'Pravilno!' : 'Tokrat mimo.') : Math.abs(guessed! - actual) <= 5 ? 'Zelo blizu.' : 'Tokrat mimo.'}
        eyebrow="Tvoja zadnja napoved"
        onBack={() => { onSeen(y); onBack() }}
        footer={<button className="btn" onClick={() => { onSeen(y); setStep(mine ? 'locked' : 'ask') }}>{mine ? 'Naprej' : 'Naprej na današnjo napoved'}</button>}
      >
        {(exact || right) && <Confetti />}
        <div className="card">
          <Tag kind={y.actualSource ?? 'MERITEV'}>{y.stationName} · {Number(hh(y.target))}h</Tag>
          <div className="duo">
            <div>
              <span className="muted">Tvoja napoved</span>
              {guessed != null ? (<><b className="big">{guessed}</b><LevelPill pm={guessed} /></>) : <b className="h2">{['Boljše', 'Enako', 'Slabše'][y.choice!]}</b>}
            </div>
            <div><span className="muted">{y.actualSource === 'MODEL' ? 'Ocena modela' : 'Izmerjeno'}</span><b className="big">{actual}</b><LevelPill pm={actual} /></div>
          </div>
          <span className="unit">µg/m³ PM2,5 · {y.choice != null && `izhodišče je bilo ${y.base} µg/m³`}</span>
          {guessed != null && (
            <Scale
              marks={[{ label: 'Ti', value: guessed, kind: 'guess' }, { label: 'Meritev', value: actual, kind: 'actual' }]}
              gap={gapOn ? [Math.min(guessed, actual), Math.max(guessed, actual)] : [Math.min(guessed, actual), Math.min(guessed, actual)]}
            />
          )}
          {y.model != null && <p className="body">Model CAMS je napovedal <b>{y.model} µg/m³</b>.</p>}
          {y.actualSource === 'MODEL' && <p className="muted small">Meritve ob tej uri nismo ujeli, zato primerjamo z modelom, umerjenim na meritev.</p>}
        </div>
        <div className="points-card"><b>+{pts}</b><span>točk</span></div>
      </Screen>
    )
  }

  if (step === 'locked' && mine) {
    return (
      <Screen title="Napoved oddana" eyebrow={`Jutri ob 8h · ${mine.stationName}`} onBack={onBack} footer={<button className="btn" onClick={onBack}>Nazaj na Igro</button>}>
        <div className="card">
          <span className="muted">Tvoja napoved</span>
          <p className="h2">{mine.choice == null ? `${mine.value} µg/m³` : ['Boljše', 'Enako', 'Slabše'][mine.choice]}</p>
          {mine.choice == null && <LevelPill pm={mine.value} />}
        </div>
        {mine.model != null && (
          <div className="card">
            <Tag kind="MODEL">CAMS · jutri ob 8h</Tag>
            <p className="h2">{mine.model} µg/m³</p>
            <LevelPill pm={mine.model} />
            <p className="muted small">Model vidiš šele po oddaji, da napoveduješ po svoje.</p>
          </div>
        )}
        <p className="body center">Rezultat izveš jutri po 9h, ko ARSO objavi meritev.</p>
      </Screen>
    )
  }

  if (!reading || base == null)
    return (
      <Screen title="Napoved" eyebrow="Napoved" onBack={onBack}>
        <p className="body muted">{reading ? 'Tvoja postaja trenutno ne meri PM2,5. Izberi drugo postajo v zavihku Zdaj.' : 'Nalagam meritve ARSO…'}</p>
      </Screen>
    )

  const name = shortName(reading.name)
  const canLock = expert || choice != null
  const lock = () => {
    const target = tomorrow8()
    const m = fc ? atHour(fc, target)?.value ?? null : null
    onGuess({ made: today, target, station: reading.code, stationName: name, base, choice: expert ? null : choice, value: expert ? value : base, model: m })
    setStep('locked')
  }

  return (
    <Screen title={`Kakšen bo zrak jutri ob 8h na postaji ${name}?`} eyebrow="Napoved" onBack={onBack} footer={<button className="btn" disabled={!canLock} onClick={lock}>Potrdi</button>}>
      <div className="card row-between">
        <div>
          <span className="muted">Zdaj ({Number(hh(reading.from))}h)</span>
          <p className="h2">{base} µg/m³</p>
        </div>
        <div className="col-end"><Tag kind="MERITEV">{name}</Tag><LevelPill pm={base} /></div>
      </div>

      <div className="switch-row">
        <span>
          <b>Strokovni način</b>
          <span className="muted small">Natančna vrednost za več točk</span>
        </span>
        <button className={expert ? 'switch on' : 'switch'} role="switch" aria-checked={expert} aria-label="Strokovni način" onClick={() => setExpert(!expert)}>
          <span />
        </button>
      </div>

      {!expert ? (
        <div className="choice3">
          {([['Boljše', '↓'], ['Enako', '='], ['Slabše', '↑']] as const).map(([w, ico], i) => (
            <button key={w} className={choice === i ? 'big-choice on' : 'big-choice'} onClick={() => setChoice(i as 0 | 1 | 2)} aria-pressed={choice === i}>
              <span className="big-ico" aria-hidden="true">{ico}</span>
              {w}
              {choice === i && <span className="check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="row-between">
            <b className="big">{value}</b>
            <LevelPill pm={value} />
          </div>
          <span className="unit">µg/m³ PM2,5 · <Tag kind="OCENA">tvoja</Tag></span>
          <Scale marks={[{ label: 'Ti', value, kind: 'guess' }]} />
          <input className="range" type="range" min="0" max="100" value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label="Tvoja napoved PM2,5 v µg/m³" />
        </div>
      )}
    </Screen>
  )
}

/* ============================================================================
 * Naloga 2: Kviz
 * ========================================================================== */
const QUIZ_LEN = 5

function Kviz({ onBack, onDone, saved }: { onBack: () => void; onDone: (r: TaskResult) => void; saved?: TaskResult }) {
  const order = Array.from({ length: QUIZ_LEN }, (_, i) => QUIZ[(dayIndex() + i) % QUIZ.length])
  const [answers, setAnswers] = useState<number[]>((saved?.answers as number[]) ?? [])
  const [index, setIndex] = useState(saved ? QUIZ_LEN : 0)
  const correctCount = answers.filter((a, i) => a === order[i].correct).length

  if (index >= QUIZ_LEN)
    return (
      <Screen title={`${correctCount} od ${QUIZ_LEN} pravilnih`} eyebrow="Kviz dneva" onBack={onBack} footer={<button className="btn" onClick={onBack}>Nazaj na Igro</button>}>
        <div className="card center-col">
          <Drop filled size={36} />
          <p className="body">Kapljica gre tvoji rastlini{correctCount ? ` in +${correctCount * 30} točk` : ''}.</p>
        </div>
        <ol className="quiz-summary">
          {order.map((q, i) => (
            <li key={q.q}>
              <span aria-hidden="true">{answers[i] === q.correct ? '✓' : '✕'}</span>
              <span>{q.q}<br /><small className="muted">{q.a[q.correct]}</small></span>
            </li>
          ))}
        </ol>
        <p className="muted small">{QUIZ_SOURCE}</p>
      </Screen>
    )

  const item = order[index]
  const picked = answers[index] ?? null
  const answered = picked != null
  const next = () => {
    if (index + 1 >= QUIZ_LEN && !saved) onDone({ points: correctCount * 30, answers, correct: correctCount })
    setIndex(index + 1)
  }
  return (
    <Screen
      title={item.q}
      eyebrow={`Kviz dneva · ${index + 1} od ${QUIZ_LEN}`}
      onBack={onBack}
      footer={answered && <button className="btn" onClick={next}>{index + 1 < QUIZ_LEN ? 'Naslednje vprašanje' : 'Zaključi kviz'}</button>}
    >
      <div className="quiz-steps" aria-hidden="true">
        {order.map((_, i) => <span key={i} className={i < index ? 'done' : i === index ? 'cur' : ''} />)}
      </div>
      <div className="answers">
        {item.a.map((a, i) => {
          const isRight = answered && i === item.correct
          const isWrong = answered && i === picked && i !== item.correct
          return (
            <button key={a} className={`answer${isRight ? ' right' : ''}${isWrong ? ' wrong' : ''}`} onClick={() => !answered && setAnswers([...answers.slice(0, index), i])} disabled={answered && !isRight && !isWrong}>
              <span>{a}</span>
              {isRight && <span className="verdict">✓ Pravilno</span>}
              {isWrong && <span className="verdict">✕ Ni pravilno</span>}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="card">
          <b className="body">{picked === item.correct ? 'Bravo, +30 točk.' : 'Nič hudega, gremo naprej.'}</b>
          <p className="body">{item.why}</p>
          <p className="muted small">{QUIZ_SOURCE}</p>
        </div>
      )}
    </Screen>
  )
}

/* ============================================================================
 * Naloga 3: Beseda dneva (familiar word-game colours, always with an icon)
 * ========================================================================== */
const KEYS = [
  ['E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Š'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Č'],
  ['ENTER', 'Ž', 'C', 'V', 'B', 'N', 'M', 'DEL'],
]
type Cell = 'hit' | 'near' | 'miss'

function score(guess: string, answer: string): Cell[] {
  const res: Cell[] = Array(5).fill('miss')
  const left: Record<string, number> = {}
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit'
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] !== 'hit' && left[guess[i]]) {
      res[i] = 'near'
      left[guess[i]]--
    }
  }
  return res
}
const STATE_ICON: Record<Cell, string> = { hit: '✓', near: '↔', miss: '✕' }
const STATE_WORD: Record<Cell, string> = { hit: 'na pravem mestu', near: 'drugje v besedi', miss: 'ni v besedi' }

function Beseda({ onBack, onDone, saved }: { onBack: () => void; onDone: (r: TaskResult) => void; saved?: TaskResult }) {
  const answer = WORDS[dayIndex() % WORDS.length]
  const [rows, setRows] = useState<string[]>((saved?.rows as string[]) ?? [])
  const [cur, setCur] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [help, setHelp] = useState(!saved && rows.length === 0)
  const solved = rows.includes(answer)
  const over = solved || rows.length >= 6

  const keyState = useMemo(() => {
    const s: Record<string, Cell> = {}
    const rank: Record<Cell, number> = { hit: 3, near: 2, miss: 1 }
    rows.forEach((r) => score(r, answer).forEach((st, i) => {
      if (!s[r[i]] || rank[st] > rank[s[r[i]]]) s[r[i]] = st
    }))
    return s
  }, [rows, answer])

  const press = (k: string) => {
    if (over) return
    setMsg('')
    if (k === 'DEL') return setCur(cur.slice(0, -1))
    if (k === 'ENTER') {
      if (cur.length < 5) return setMsg('Beseda ima 5 črk.')
      const next = [...rows, cur]
      setRows(next)
      setCur('')
      const ok = next.includes(answer)
      if ((ok || next.length >= 6) && !saved) onDone({ points: ok ? (7 - next.length) * 10 : 0, rows: next, solved: ok })
      return
    }
    if (cur.length < 5) setCur(cur + k)
  }

  const grid = rows.map((r) => score(r, answer))
  const shareText = `Zrak · Beseda dneva ${solved ? rows.length : 'X'}/6\n` + grid.map((g) => g.map((s) => ({ hit: '🟩', near: '🟨', miss: '⬜' })[s]).join('')).join('\n')

  if (help)
    return (
      <Screen title="Kako igraš?" eyebrow="Beseda dneva" onBack={onBack} footer={<button className="btn" onClick={() => setHelp(false)}>Razumem, začnimo</button>}>
        <div className="card help">
          <ol className="body">
            <li>Ugani besedo s <b>5 črkami</b>. Imaš <b>6 poskusov</b>.</li>
            <li>Vpiši katerokoli besedo s 5 črkami in pritisni <b>Potrdi</b>.</li>
            <li>Ploščice se obarvajo in povedo, kako blizu si.</li>
          </ol>
        </div>
        <div className="card help-example">
          <b className="body">Primer: SONCE</b>
          <div className="help-row" aria-hidden="true">
            {([['S', 'hit'], ['O', 'near'], ['N', 'miss'], ['C', 'miss'], ['E', 'miss']] as const).map(([l, s]) => (
              <div key={l} className={`wcell ${s}`}><span className="wl">{l}</span><span className="wi">{STATE_ICON[s]}</span></div>
            ))}
          </div>
          <p className="help-line"><i className="sw hit">✓</i><span><b>Zelena:</b> S je v besedi in na pravem mestu.</span></p>
          <p className="help-line"><i className="sw near">↔</i><span><b>Rumena:</b> O je v besedi, a na drugem mestu.</span></p>
          <p className="help-line"><i className="sw miss">✕</i><span><b>Siva:</b> N, C in E jih v besedi ni.</span></p>
        </div>
        <p className="body muted">Vsak dan je nova beseda, povezana z zrakom. Brez časovne omejitve.</p>
      </Screen>
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
    } catch {
      setMsg('Kopiranje ni uspelo. Označi besedilo spodaj.')
    }
  }

  return (
    <Screen title="Ugani besedo" eyebrow="Beseda dneva · 5 črk, 6 poskusov" onBack={onBack}>
      <div className="row-between">
        <span className="muted small">Zelena ✓ pravo mesto · rumena ↔ drugje · siva ✕ ni v besedi</span>
        <button className="help-btn" onClick={() => setHelp(true)} aria-label="Kako igraš?">?</button>
      </div>
      <div className="wgrid" aria-label="Poskusi">
        {Array.from({ length: 6 }, (_, r) => {
          const word = rows[r] ?? (r === rows.length ? cur : '')
          const st = rows[r] ? grid[r] : null
          return (
            <div className="wrow" key={r}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`wcell ${st ? st[i] : word[i] ? 'typed' : ''}`} aria-label={st ? `${word[i]}, ${STATE_WORD[st[i]]}` : word[i] || 'prazno'}>
                  <span className="wl">{word[i] ?? ''}</span>
                  {st && <span className="wi" aria-hidden="true">{STATE_ICON[st[i]]}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {msg && <p className="body center" role="status">{msg}</p>}

      {over ? (
        <div className="card">
          <b className="body">{solved ? `Uganil(a) si v ${rows.length}. poskusu. +${(7 - rows.length) * 10} točk.` : `Beseda je bila ${answer}.`}</b>
          <p className="body"><b>Ali veš?</b> {WORD_FACTS[answer]}</p>
          <div className="share-grid" aria-label="Mreža za deljenje brez črk">
            {grid.map((g, r) => (
              <div key={r}>{g.map((s, i) => <span key={i} className={`sq ${s}`} />)}</div>
            ))}
          </div>
          <button className="btn-soft" onClick={copy}>{copied ? 'Kopirano' : 'Kopiraj rezultat'}</button>
          {msg && <pre className="share-pre">{shareText}</pre>}
          <button className="btn" onClick={onBack}>Nazaj na Igro</button>
        </div>
      ) : (
        <div className="kbd">
          {KEYS.map((row, i) => (
            <div key={i} className="krow">
              {row.map((k) => (
                <button key={k} className={`key ${keyState[k] ?? ''} ${k.length > 1 ? 'wide' : ''}`} onClick={() => press(k)} aria-label={k === 'DEL' ? 'Briši' : k === 'ENTER' ? 'Potrdi besedo' : k}>
                  {k === 'DEL' ? '⌫' : k === 'ENTER' ? 'Potrdi' : k}
                  {keyState[k] && k.length === 1 && <small aria-hidden="true">{STATE_ICON[keyState[k]]}</small>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}

/* ============================================================================
 * Naloga 4: Dih (pace from the profile chosen at onboarding)
 * ========================================================================== */
function Dih({ onBack, onDone, saved, profile }: { onBack: () => void; onDone: (r: TaskResult) => void; saved?: TaskResult; profile: ProfileKey }) {
  const p = BREATH[profile] ?? BREATH.nihce
  const total = p.minutes * 60
  const [phase, setPhase] = useState<'intro' | 'run' | 'end'>('intro')
  const [inhale, setInhale] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (phase !== 'run') return
    let t: ReturnType<typeof setTimeout>
    const cycle = (isIn: boolean) => {
      setInhale(isIn)
      t = setTimeout(() => cycle(!isIn), (isIn ? p.inhale : p.exhale) * 1000)
    }
    cycle(true)
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { clearTimeout(t); clearInterval(tick) }
  }, [phase, p.inhale, p.exhale])

  const finish = () => {
    setPhase('end')
    if (!saved) onDone({ points: 0 })
  }
  useEffect(() => {
    if (phase === 'run' && elapsed >= total) finish()
  }, [elapsed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'intro')
    return (
      <Screen title="Minuta mirnega dihanja" eyebrow={`Dih · ${p.label}`} onBack={onBack} footer={<button className="btn" onClick={() => { setElapsed(0); setPhase('run') }}>Začni</button>}>
        <div className="card">
          <p className="body">
            Vdih {p.inhale} s, izdih {p.exhale} s, skupaj {p.minutes === 1 ? '1 minuta' : `${p.minutes} minuti`}. Brez zadrževanja diha.
            {p.seated && ' Sedi udobno, z oporo za hrbet.'}
          </p>
          <p className="body">Če ti postane slabo ali se ti zvrti, prenehaj in dihaj normalno.</p>
          {profile === 'astma' && <p className="body"><b>Vaja ne nadomešča zdravil ali inhalatorja.</b></p>}
        </div>
        <p className="muted small">Tempo je prilagojen profilu, ki si ga izbral(a) ob prvem zagonu.</p>
      </Screen>
    )

  if (phase === 'end')
    return (
      <Screen title="Lepo opravljeno." eyebrow="Dih" onBack={onBack} footer={<button className="btn" onClick={onBack}>Nazaj na Igro</button>}>
        <div className="card center-col">
          <Drop filled size={36} />
          <p className="body">Kapljica gre tvoji rastlini.</p>
        </div>
      </Screen>
    )

  return (
    <div className={`screen breath ${p.large ? 'large' : ''}`}>
      <div className="screen-head"><span className="eyebrow">Dih · {p.label}</span></div>
      <div className="breath-stage">
        <div className="breath-circle" style={{ transform: `scale(${inhale ? 1 : 0.55})`, transitionDuration: `${(inhale ? p.inhale : p.exhale) * 1000}ms` }} />
        <p className="breath-word" aria-live="polite">{inhale ? p.inWord : p.outWord}</p>
      </div>
      <div className="breath-progress" aria-hidden="true"><div style={{ width: `${(elapsed / total) * 100}%` }} /></div>
      <div className="screen-foot"><button className="btn-soft" onClick={finish}>Končaj</button></div>
    </div>
  )
}

/* ============================================================================
 * Home
 * ========================================================================== */
function Home({ done, onOpen, streak, xp }: {
  done: Partial<Record<TaskKey, TaskResult>>
  onOpen: (v: View) => void
  streak: number
  xp: number
}) {
  const drops = Object.keys(done).length
  return (
    <div className="screen home">
      <header className="hero hero-duo">
        <Plant stage={drops} size={150} />
        <Golob3D size={110} line={drops === 4 ? 'Bravo. Danes si vse opravil(a).' : drops === 0 ? 'Grem s tabo. Štiri naloge.' : `Še ${4 - drops} ${4 - drops === 1 ? 'naloga' : 4 - drops === 2 ? 'nalogi' : 'naloge'}.`} />
        <p className="hero-line">{drops === 0 ? 'Rastlina je žejna. Ena naloga jo osveži.' : drops === 4 ? 'Rastlina je danes v polnem cvetu.' : 'Rastlina raste z vsako nalogo.'}</p>
      </header>

      <section className="status">
        <div className="row-between">
          <b className="h3">Danes: {drops} od 4</b>
          <span className="drops" aria-label={`${drops} od 4 kapljic`}>
            {[0, 1, 2, 3].map((i) => <Drop key={i} filled={i < drops} />)}
          </span>
        </div>
        <div className="row-between">
          <span className="streak">
            <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden="true"><path d="M10 1c1 5 7 7 7 14a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 4 3 4-1-4 0-7 0-10Z" fill="#F2994A" /></svg>
            {streak} {streak === 1 ? 'dan' : 'dni'} zapored
          </span>
          <span className="muted small">{xp % XP_LEVEL} / {XP_LEVEL} XP</span>
        </div>
        <div className="xp" role="progressbar" aria-label="Napredek do naslednje stopnje" aria-valuenow={xp % XP_LEVEL} aria-valuemax={XP_LEVEL}>
          <div style={{ width: `${((xp % XP_LEVEL) / XP_LEVEL) * 100}%` }} />
        </div>
      </section>

      <section className="tasks">
        {TASKS.map((t) => (
          <button key={t.key} className={done[t.key] ? 'task done' : 'task'} onClick={() => onOpen(t.key)}>
            <span className="task-ico"><TaskIcon name={t.icon} /></span>
            <span className="task-text">
              <b>{t.title}</b>
              <span>{t.sub}</span>
              <span className="small muted">{t.time} · {t.reward}</span>
            </span>
            <span className={done[t.key] ? 'status-chip ok' : 'status-chip'}>{done[t.key] ? '✓ Opravljeno' : 'Čaka'}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

/* ============================================================================
 * Tab root
 * ========================================================================== */
type View = 'home' | TaskKey

interface Props {
  reading?: Reading
  fc?: Forecast
  profile: ProfileKey
  log: GameLog
}

export default function Naloge({ reading, fc, profile, log }: Props) {
  const [view, setView] = useState<View>('home')
  const [tasks, setTasks] = useState<TaskLog>(loadTasks)
  const [guesses, setGuesses] = useState<(Guess & { seen?: boolean })[]>(loadGuesses)
  useEffect(() => { saveTasks(tasks) }, [tasks])
  // The widget shows Golob with red eyes while today's tasks wait
  useEffect(() => {
    const day = dateStr(new Date())
    void syncWidget({ tasksDone: String(Object.keys(tasks[day] ?? {}).length), tasksDay: day })
  }, [tasks])
  useEffect(() => { saveGuesses(guesses) }, [guesses])
  useEffect(() => { window.scrollTo(0, 0) }, [view])

  // Resolve open forecasts: the ARSO measurement when we see it, otherwise the calibrated model 2 h later
  useEffect(() => {
    if (!reading) return
    const now = hourStr(new Date())
    const later = hourStr(new Date(Date.now() - 2 * 3600000))
    setGuesses((gs) => {
      let changed = false
      const next = gs.map((g) => {
        if (g.station !== reading.code || (g.actual != null && g.actualSource === 'MERITEV')) return g
        if (reading.from === g.target && reading.pm25 != null) {
          changed = true
          return { ...g, actual: reading.pm25, actualSource: 'MERITEV' as const }
        }
        if (g.actual == null && g.target <= later && g.target <= now && fc) {
          const h = atHour(fc, g.target)
          if (h) {
            changed = true
            return { ...g, actual: h.value, actualSource: 'MODEL' as const }
          }
        }
        return g
      })
      return changed ? next : gs
    })
  }, [reading, fc])

  const today = dateStr(new Date())
  const done = tasks[today] ?? {}
  const finish = (key: TaskKey) => (r: TaskResult) => setTasks((t) => ({ ...t, [today]: { ...(t[today] ?? {}), [key]: r } }))
  const back = () => setView('home')

  const resolved = guesses.filter((g) => g.actual != null)
  const xp = totalXp(log) + taskTotalPoints(tasks) + resolved.reduce((s, g) => s + guessPoints(g), 0) + Object.values(tasks).reduce((s, d) => s + Object.keys(d).length * 10, 0)

  return (
    <div className="ng">
      {view === 'home' && (
        <Home done={done} onOpen={setView} streak={playStreak(tasks, log)} xp={xp} />
      )}
      {view === 'napoved' && (
        <Napoved
          reading={reading}
          fc={fc}
          guesses={guesses}
          onBack={back}
          onGuess={(g) => {
            setGuesses((gs) => [...gs, g])
            finish('napoved')({ points: 0 })
          }}
          onSeen={(g) => setGuesses((gs) => gs.map((x) => (x === g || (x.made === g.made && x.target === g.target) ? { ...x, seen: true } : x)))}
        />
      )}
      {view === 'kviz' && <Kviz onBack={back} onDone={finish('kviz')} saved={done.kviz} />}
      {view === 'beseda' && <Beseda onBack={back} onDone={finish('beseda')} saved={done.beseda} />}
      {view === 'dih' && <Dih onBack={back} onDone={finish('dih')} saved={done.dih} profile={profile} />}
    </div>
  )
}

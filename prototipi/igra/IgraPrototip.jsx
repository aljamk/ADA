// Zrak · zavihek "Igra" — interaktivni prototip (ADA Hack 2026)
// Ena komponenta, stanje samo v pomnilniku. V aplikaciji: import React from 'react'
const { useState, useEffect, useRef, useMemo } = React

/* ============================================================================
 * MOCK PODATKI — zamenjaj z resničnimi podatki ARSO / igre.
 * Vse vrednosti zraka so primeri in ne izvirajo iz meritev.
 * ========================================================================== */
const MOCK = {
  station: 'Bežigrad',
  // Trenutni zrak za widget
  now: { pm25: 21, time: '14:00', advice: 'Za občutljive: krajši sprehod do 18h.' },
  // Napoved: včerajšnja ocena in današnja meritev ob 8h (za razkritje)
  yesterday: { guess: 31, actual: 31, time: '8:00' }, // natančen zadetek → konfeti
  todayAt8: 31, // današnja meritev ob 8h (izhodišče za Boljše / Enako / Slabše)
  modelTomorrow: 36, // napoved modela za jutri ob 8h (pokaže se šele po oddaji)
  streakDays: 6,
  xp: 320,
  xpPerLevel: 500,
  vsModel: { me: 4, model: 3 },
  myCetrt: 'Šiška',
  // Tedenske točke v ligi (po točkah igre, NE po kakovosti zraka)
  league: {
    Bežigrad: 1480, Center: 1395, Trnovo: 1320, Vič: 1210, Moste: 1180, Rožnik: 1120, Šiška: 1090,
    Posavje: 1040, Jarše: 990, Dravlje: 960, Golovec: 905, Polje: 870, Črnuče: 820, Rudnik: 770,
    Šentvid: 700, Sostro: 640, 'Šmarna gora': 590,
  },
  quiz: [
    {
      q: 'Kdaj je pozimi zrak v Ljubljani najslabši?',
      a: ['Zjutraj ob 7h', 'Opoldne', 'Zvečer med 21. in 23. uro'],
      correct: 2,
      why: 'Zvečer se ogrevanje in promet ujameta pod inverzijo, zato delci dosežejo vrh med 21. in 23. uro.',
    },
    {
      q: 'Kaj je inverzija?',
      a: ['Topel zrak nad hladnim, ki zapre kotlino', 'Močan veter z gora', 'Dež, ki spere delce'],
      correct: 0,
      why: 'Pri inverziji topla plast nad kotlino deluje kot pokrov, zato delci ostanejo pri tleh.',
    },
    {
      q: 'Kateri vir pozimi največ prispeva k delcem v Ljubljani?',
      a: ['Tovarne', 'Kurjenje drv v pečeh', 'Letala'],
      correct: 1,
      why: 'Male kurilne naprave na les so pozimi glavni vir drobnih delcev v kotlini.',
    },
    {
      q: 'Kdaj je pozimi najbolje prezračiti stanovanje?',
      a: ['Pozno zvečer', 'Sredi dneva, na kratko', 'Ponoči z odprtim oknom'],
      correct: 1,
      why: 'Sredi dneva je zrak običajno najčistejši, kratko in močno zračenje pa zamenja zrak hitro.',
    },
    {
      q: 'Kje je ob prometni konici zrak navadno slabši?',
      a: ['Ob glavni cesti', 'V parku', 'Enako povsod'],
      correct: 0,
      why: 'Ob prometnih cestah je dušikovega dioksida in delcev več kot nekaj ulic stran.',
    },
  ],
  words: ['MEGLA', 'DELCI', 'VETER', 'KISIK', 'IZDIH', 'BURJA', 'PEČKA', 'PELOD', 'OBLAK', 'ASTMA'],
  wordFacts: {
    MEGLA: 'Megla pogosto spremlja inverzijo, ko se delci ujamejo pri tleh.',
    DELCI: 'Delci PM2,5 so tako drobni, da pridejo globoko v pljuča.',
    VETER: 'Že zmeren veter lahko v nekaj urah prečisti zrak v kotlini.',
    KISIK: 'Zrak, ki ga dihamo, ima približno 21 % kisika.',
    IZDIH: 'Počasen izdih umiri dihanje in srčni utrip.',
    BURJA: 'Burja je sunkovit veter na Primorskem, ki zrak hitro premeša.',
    PEČKA: 'Stara peč na drva lahko odda več delcev kot sto sodobnih plinskih kotlov.',
    PELOD: 'Pelod ni delec onesnaženja, a lahko poslabša astmo spomladi.',
    OBLAK: 'Oblačne zimske noči so toplejše, zato je inverzija pogosto šibkejša.',
    ASTMA: 'Ljudje z astmo občutijo slab zrak prej, zato zanje opozarjamo že pri zmernem.',
  },
  quizSource: 'Vir: meritve ARSO 2016–2026',
}

/* ---------- Lestvica zraka: vedno barva + ikona + beseda ---------- */
const LEVELS = [
  { key: 'dobro', word: 'Dobro', color: '#3BB273', icon: '✓', max: 15 },
  { key: 'zmerno', word: 'Zmerno', color: '#F2C94C', icon: '–', max: 25 },
  { key: 'slabo', word: 'Slabo', color: '#F2994A', icon: '▲', max: 50 },
  { key: 'zeloslabo', word: 'Zelo slabo', color: '#E5484D', icon: '!', max: 75 },
  { key: 'nevarno', word: 'Nevarno', color: '#8E4EC6', icon: '!!', max: 100 },
]
const levelOf = (pm) => LEVELS.find((l) => pm < l.max) ?? LEVELS[LEVELS.length - 1]
/** Razpon stopnje v µg/m³, npr. "15–25" za Zmerno. */
const levelRange = (l) => {
  const i = LEVELS.indexOf(l)
  return i === LEVELS.length - 1 ? `nad ${LEVELS[i - 1].max}` : `${i === 0 ? 0 : LEVELS[i - 1].max}–${l.max}`
}

const PROFILES = {
  nihce: { label: 'Nihče posebej', inhale: 4, exhale: 6, minutes: 2, inWord: 'Vdihni', outWord: 'Izdihni' },
  astma: { label: 'Astma', inhale: 2, exhale: 4, minutes: 1, inWord: 'Vdihni skozi nos', outWord: 'Izdihni skozi stisnjene ustnice' },
  nosecnost: { label: 'Nosečnost', inhale: 4, exhale: 6, minutes: 1, seated: true, inWord: 'Vdihni', outWord: 'Izdihni' },
  starejsi: { label: 'Starejši', inhale: 3, exhale: 5, minutes: 1, seated: true, large: true, inWord: 'Vdihni', outWord: 'Izdihni' },
}

const TASKS = [
  { key: 'napoved', title: 'Napoved', sub: 'Kakšen bo zrak jutri?', time: '1 min', reward: 'Kapljica + točke za četrt', icon: 'forecast' },
  { key: 'kviz', title: 'Kviz', sub: 'Pet vprašanj', time: '2 min', reward: 'Kapljica + točke', icon: 'quiz' },
  { key: 'beseda', title: 'Beseda dneva', sub: 'Ugani besedo', time: '2 min', reward: 'Kapljica + točke', icon: 'word' },
  { key: 'dih', title: 'Dih', sub: 'Minuta mirnega dihanja', time: '1–2 min', reward: 'Samo kapljica', icon: 'breath' },
]

const dayIndex = () => Math.floor(Date.now() / 86400000)
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/* ============================================================================
 * Majhni gradniki
 * ========================================================================== */
function Tag({ kind, children }) {
  // MERITEV = poln krog, MODEL = črtkan okvir, OCENA = prazen krog
  return (
    <span className={`tag tag-${kind.toLowerCase()}`}>
      {kind !== 'MODEL' && <span className="tag-dot" aria-hidden="true" />}
      {kind}
      {children && <span className="tag-rest"> · {children}</span>}
    </span>
  )
}

function LevelPill({ pm }) {
  const l = levelOf(pm)
  return (
    <span className="level-pill">
      <span className="level-ico" style={{ background: l.color }} aria-hidden="true">{l.icon}</span>
      {l.word}
    </span>
  )
}

function Drop({ filled, size = 22 }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 20 25" aria-hidden="true">
      <path d="M10 1.5C10 1.5 2 10.5 2 16a8 8 0 0 0 16 0C18 10.5 10 1.5 10 1.5Z" fill={filled ? 'var(--primary)' : 'none'} stroke="var(--primary)" strokeWidth="1.8" />
    </svg>
  )
}

function TaskIcon({ name }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'forecast' && (<><path {...p} d="M7 17h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 10 3.5 3.5 0 0 0 7 17Z" /><path {...p} d="M12 20v2M8 20l-1 2M16 20l1 2" /></>)}
      {name === 'quiz' && (<><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7M12 17h.01" /></>)}
      {name === 'word' && (<><rect {...p} x="3" y="7" width="5" height="10" rx="1.2" /><rect {...p} x="9.5" y="7" width="5" height="10" rx="1.2" /><rect {...p} x="16" y="7" width="5" height="10" rx="1.2" /></>)}
      {name === 'breath' && (<><path {...p} d="M3 9h11a3 3 0 1 0-3-3" /><path {...p} d="M3 13h15a3 3 0 1 1-3 3" /><path {...p} d="M3 17h6" /></>)}
    </svg>
  )
}

/** Rastlina v obrisu pljuč. stage 0 = povešena (nikoli mrtva), 4 = polno zrasla s cvetom. */
function Plant({ stage, size = 200 }) {
  const wilted = stage === 0
  const leaf = wilted ? '#8FA79C' : '#3E9C6B'
  const leafDark = wilted ? '#7A9187' : '#2D7F55'
  const stemTop = [118, 104, 88, 72, 58][stage]
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={wilted ? 'Rastlina je žejna' : `Rastlina, stopnja rasti ${stage} od 4`}>
      {/* obris pljuč (logotip) */}
      <path d="M100 30v46M100 76c-8 0-14 6-20 14M100 76c8 0 14 6 20 14" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 66C52 60 30 92 28 128c-2 30 12 46 34 44 20-2 30-14 32-36l2-52c0-10-8-16-18-18Z" fill="var(--lung)" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M122 66c26-6 48 26 50 62 2 30-12 46-34 44-20-2-30-14-32-36l-2-52c0-10 8-16 18-18Z" fill="var(--lung)" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" />
      {/* lonček / zemlja */}
      <ellipse cx="100" cy="160" rx="30" ry="7" fill="var(--soil)" />
      {/* steblo */}
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
      color: ['#7EC8E3', '#0077A3', '#F4F9FB', '#3BB273'][i % 4],
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

/** Barvna lestvica PM2,5 0–100 µg/m³ z oznakami */
function Scale({ marks = [], gap }) {
  return (
    <div className="scale">
      <div className="scale-track">
        {LEVELS.map((l, i) => (
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

function Screen({ title, eyebrow, onBack, children, footer }) {
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
 * Naloga 1: Napoved
 * ========================================================================== */
function Napoved({ onBack, onDone, done, saved }) {
  const y = MOCK.yesterday
  const [step, setStep] = useState(saved ? 'locked' : y ? 'reveal' : 'ask')
  const [expert, setExpert] = useState(false)
  const [choice, setChoice] = useState(saved?.choice ?? null)
  const [value, setValue] = useState(saved?.value ?? MOCK.todayAt8)
  const [gapOn, setGapOn] = useState(false)
  const exact = y && y.guess === y.actual
  const yPoints = y ? Math.max(0, 150 - 10 * Math.abs(y.guess - y.actual)) : 0

  useEffect(() => {
    if (step === 'reveal') {
      const t = setTimeout(() => setGapOn(true), 300)
      return () => clearTimeout(t)
    }
  }, [step])

  if (step === 'reveal')
    return (
      <Screen
        title={exact ? 'Natančno!' : Math.abs(y.guess - y.actual) <= 5 ? 'Zelo blizu.' : 'Tokrat mimo.'}
        eyebrow="Včerajšnja napoved"
        onBack={onBack}
        footer={<button className="btn" onClick={() => setStep('ask')}>Naprej na današnjo napoved</button>}
      >
        {exact && <Confetti />}
        <div className="card">
          <Tag kind="MERITEV">{MOCK.station} · {y.time}</Tag>
          <div className="duo">
            <div><span className="muted">Tvoja napoved</span><b className="big">{y.guess}</b><LevelPill pm={y.guess} /></div>
            <div><span className="muted">Izmerjeno</span><b className="big">{y.actual}</b><LevelPill pm={y.actual} /></div>
          </div>
          <span className="unit">µg/m³ PM2,5 · jutri ob 8h</span>
          <Scale
            marks={[{ label: 'Ti', value: y.guess, kind: 'guess' }, { label: 'Meritev', value: y.actual, kind: 'actual' }]}
            gap={gapOn ? [Math.min(y.guess, y.actual), Math.max(y.guess, y.actual)] : [Math.min(y.guess, y.actual), Math.min(y.guess, y.actual)]}
          />
          <p className="body">Razlika: <b>{Math.abs(y.guess - y.actual)} µg/m³</b></p>
        </div>
        <div className="points-card"><b>+{yPoints}</b><span>točk za {MOCK.myCetrt}</span></div>
      </Screen>
    )

  if (step === 'locked') {
    const m = MOCK.modelTomorrow
    return (
      <Screen
        title="Napoved oddana"
        eyebrow="Jutri ob 8h · Bežigrad"
        onBack={onBack}
        footer={<button className="btn" onClick={onBack}>Nazaj na Igro</button>}
      >
        <div className="card">
          <span className="muted">Tvoja napoved</span>
          <p className="h2">{expert || choice == null ? `${value} µg/m³` : ['Boljše', 'Enako', 'Slabše'][choice]}</p>
          {(expert || choice == null) && <LevelPill pm={value} />}
        </div>
        <div className="card">
          <Tag kind="MODEL">CAMS · jutri ob 8h</Tag>
          <p className="h2">{m} µg/m³</p>
          <LevelPill pm={m} />
          <p className="muted small">Model vidiš šele po oddaji, da napoveduješ po svoje.</p>
        </div>
        <p className="body center">Rezultat izveš jutri zjutraj.</p>
      </Screen>
    )
  }

  const base = MOCK.todayAt8
  const canLock = expert || choice != null
  const lock = () => {
    setStep('locked')
    if (!done) onDone({ choice: expert ? null : choice, value })
  }

  return (
    <Screen
      title="Kakšen bo zrak jutri ob 8h na Bežigradu?"
      eyebrow="Napoved"
      onBack={onBack}
      footer={<button className="btn" disabled={!canLock} onClick={lock}>Potrdi</button>}
    >
      <div className="card row-between">
        <div>
          <span className="muted">Danes ob 8h</span>
          <p className="h2">{base} µg/m³</p>
        </div>
        <div className="col-end"><Tag kind="MERITEV">{MOCK.station}</Tag><LevelPill pm={base} /></div>
      </div>

      <label className="switch-row">
        <span>
          <b>Strokovni način</b>
          <span className="muted small">Natančna vrednost za več točk</span>
        </span>
        <button className={expert ? 'switch on' : 'switch'} role="switch" aria-checked={expert} onClick={() => setExpert(!expert)}>
          <span />
        </button>
      </label>

      {!expert ? (
        <div className="choice3">
          {[['Boljše', '↓'], ['Enako', '='], ['Slabše', '↑']].map(([w, ico], i) => (
            <button key={w} className={choice === i ? 'big-choice on' : 'big-choice'} onClick={() => setChoice(i)} aria-pressed={choice === i}>
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
          <input
            className="range" type="range" min="0" max="100" value={value}
            onChange={(e) => setValue(Number(e.target.value))} aria-label="Tvoja napoved PM2,5 v µg/m³"
          />
        </div>
      )}
    </Screen>
  )
}

/* ============================================================================
 * Naloga 2: Kviz
 * ========================================================================== */
const QUIZ_LEN = 5

function Kviz({ onBack, onDone, done, saved }) {
  // Five questions in a row; the daily order rotates by date
  const order = Array.from({ length: QUIZ_LEN }, (_, i) => MOCK.quiz[(dayIndex() + i) % MOCK.quiz.length])
  const [answers, setAnswers] = useState(saved?.answers ?? [])
  const [index, setIndex] = useState(saved ? QUIZ_LEN : 0)
  const correctCount = answers.filter((a, i) => a === order[i].correct).length

  if (index >= QUIZ_LEN)
    return (
      <Screen title={`${correctCount} od ${QUIZ_LEN} pravilnih`} eyebrow="Kviz dneva" onBack={onBack} footer={<button className="btn" onClick={onBack}>Nazaj na Igro</button>}>
        <div className="card center-col">
          <Drop filled size={36} />
          <p className="body">Kapljica gre tvoji rastlini{correctCount ? ` in +${correctCount * 30} točk tvoji četrti` : ''}.</p>
        </div>
        <ol className="quiz-summary">
          {order.map((q, i) => (
            <li key={q.q}>
              <span aria-hidden="true">{answers[i] === q.correct ? '✓' : '✕'}</span>
              <span>{q.q}<br /><small className="muted">{q.a[q.correct]}</small></span>
            </li>
          ))}
        </ol>
        <p className="muted small">{MOCK.quizSource}</p>
      </Screen>
    )

  const item = order[index]
  const picked = answers[index] ?? null
  const answered = picked != null
  const pick = (i) => {
    if (answered) return
    setAnswers([...answers.slice(0, index), i])
  }
  const next = () => {
    if (index + 1 >= QUIZ_LEN && !done) onDone({ answers, correct: correctCount })
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
            <button key={a} className={`answer${isRight ? ' right' : ''}${isWrong ? ' wrong' : ''}`} onClick={() => pick(i)} disabled={answered && !isRight && !isWrong}>
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
          <p className="muted small">{MOCK.quizSource}</p>
        </div>
      )}
    </Screen>
  )
}

/* ============================================================================
 * Naloga 3: Beseda dneva
 * ========================================================================== */
const KEYS = [
  ['E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Š'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Č'],
  ['ENTER', 'Ž', 'C', 'V', 'B', 'N', 'M', 'DEL'],
]

function score(guess, answer) {
  // 'hit' = prava mesto, 'near' = drugje v besedi, 'miss' = ni v besedi (podvojene črke pravilno)
  const res = Array(5).fill('miss')
  const left = {}
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
const STATE_ICON = { hit: '✓', near: '↔', miss: '✕' }
const STATE_WORD = { hit: 'na pravem mestu', near: 'drugje v besedi', miss: 'ni v besedi' }

function Beseda({ onBack, onDone, done, saved }) {
  const answer = MOCK.words[dayIndex() % MOCK.words.length]
  const [rows, setRows] = useState(saved?.rows ?? [])
  const [cur, setCur] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [help, setHelp] = useState(!saved && rows.length === 0) // instructions open before the first guess
  const solved = rows.includes(answer)
  const over = solved || rows.length >= 6

  const keyState = useMemo(() => {
    const s = {}
    const rank = { hit: 3, near: 2, miss: 1 }
    rows.forEach((r) => score(r, answer).forEach((st, i) => {
      if (!s[r[i]] || rank[st] > rank[s[r[i]]]) s[r[i]] = st
    }))
    return s
  }, [rows, answer])

  const press = (k) => {
    if (over) return
    setMsg('')
    if (k === 'DEL') return setCur(cur.slice(0, -1))
    if (k === 'ENTER') {
      if (cur.length < 5) return setMsg('Beseda ima 5 črk.')
      const next = [...rows, cur]
      setRows(next)
      setCur('')
      if ((next.includes(answer) || next.length >= 6) && !done) onDone({ rows: next, solved: next.includes(answer) })
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
            {[['S', 'hit'], ['O', 'near'], ['N', 'miss'], ['C', 'miss'], ['E', 'miss']].map(([l, s]) => (
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
          <p className="body"><b>Ali veš?</b> {MOCK.wordFacts[answer]}</p>
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
                <button
                  key={k}
                  className={`key ${keyState[k] ?? ''} ${k.length > 1 ? 'wide' : ''}`}
                  onClick={() => press(k)}
                  aria-label={k === 'DEL' ? 'Briši' : k === 'ENTER' ? 'Potrdi besedo' : k}
                >
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
 * Naloga 4: Dih
 * ========================================================================== */
function Dih({ onBack, onDone, done, profile, onProfile }) {
  const p = PROFILES[profile]
  const total = p.minutes * 60
  const [phase, setPhase] = useState('intro') // intro | run | end
  const [inhale, setInhale] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (phase !== 'run') return
    let t
    const cycle = (isIn) => {
      setInhale(isIn)
      t = setTimeout(() => cycle(!isIn), (isIn ? p.inhale : p.exhale) * 1000)
    }
    cycle(true)
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { clearTimeout(t); clearInterval(tick) }
  }, [phase, p.inhale, p.exhale])

  useEffect(() => {
    if (phase === 'run' && elapsed >= total) finish()
  }, [elapsed]) // eslint-disable-line

  function finish() {
    setPhase('end')
    if (!done) onDone({})
  }

  if (phase === 'intro')
    return (
      <Screen title="Minuta mirnega dihanja" eyebrow="Dih" onBack={onBack} footer={<button className="btn" onClick={() => { setElapsed(0); setPhase('run') }}>Začni</button>}>
        <div className="card">
          <p className="body">
            Vdih {p.inhale} s, izdih {p.exhale} s, skupaj {p.minutes === 1 ? '1 minuta' : `${p.minutes} minuti`}. Brez zadrževanja diha.
            {p.seated && ' Sedi udobno, z oporo za hrbet.'}
          </p>
          <p className="body">Če ti postane slabo ali se ti zvrti, prenehaj in dihaj normalno.</p>
          {profile === 'astma' && <p className="body"><b>Vaja ne nadomešča zdravil ali inhalatorja.</b></p>}
        </div>
        <label className="demo-select small">
          Profil iz uvoda (demo):
          <select value={profile} onChange={(e) => onProfile(e.target.value)}>
            {Object.entries(PROFILES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
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

  const dur = (inhale ? p.inhale : p.exhale) * 1000
  return (
    <div className={`screen breath ${p.large ? 'large' : ''}`}>
      <div className="screen-head"><span className="eyebrow">Dih · {p.label}</span></div>
      <div className="breath-stage">
        <div className="breath-circle" style={{ transform: `scale(${inhale ? 1 : 0.55})`, transitionDuration: `${dur}ms` }} />
        <p className="breath-word" aria-live="polite">{inhale ? p.inWord : p.outWord}</p>
      </div>
      <div className="breath-progress" aria-hidden="true"><div style={{ width: `${(elapsed / total) * 100}%` }} /></div>
      <div className="screen-foot"><button className="btn-soft" onClick={finish}>Končaj</button></div>
    </div>
  )
}

/* ============================================================================
 * Widget (predogled, brez interakcije)
 * ========================================================================== */
/** Barvna lestvica PM2,5 z oznako, kje je zdajšnja vrednost (vsaka stopnja enako široka). */
function WidgetScale({ pm }) {
  const l = levelOf(pm)
  const i = LEVELS.indexOf(l)
  const lo = i === 0 ? 0 : LEVELS[i - 1].max
  const pos = ((i + Math.min(1, (pm - lo) / (l.max - lo))) / LEVELS.length) * 100
  return (
    <div className="w-scale" role="img" aria-label={`PM2,5 ${pm} µg/m³ je na lestvici ${l.word.toLowerCase()}, od ${levelRange(l)} µg/m³`}>
      <div className="w-scale-bar">
        {LEVELS.map((x) => <span key={x.key} style={{ background: x.color, opacity: x === l ? 1 : 0.45 }} />)}
        <i style={{ left: `${pos}%` }} />
      </div>
      <div className="w-scale-ticks" aria-hidden="true">
        {[0, ...LEVELS.slice(0, -1).map((x) => x.max)].map((t) => <span key={t}>{t}</span>)}
      </div>
    </div>
  )
}

function Widgets({ drops }) {
  const l = levelOf(MOCK.now.pm25)
  const left = 4 - drops
  const tasksLeft = left === 0 ? 'Vse naloge opravljene' : `Še ${left} ${left === 1 ? 'naloga' : left === 2 ? 'nalogi' : 'naloge'}`
  return (
    <div className="widgets" aria-label="Predogled widgetov na začetnem zaslonu">
      <p className="eyebrow light">Začetni zaslon · predogled</p>
      <div className="w22">
        <span className="w-verdict"><span className="level-ico" style={{ background: l.color }}>{l.icon}</span>{l.word.toUpperCase()}</span>
        <span className="w-pm"><b>{MOCK.now.pm25}</b> µg/m³ <small>fini delci PM2,5</small></span>
        <WidgetScale pm={MOCK.now.pm25} />
        <span className="w-what">{l.word} = {levelRange(l)} µg/m³</span>
        <Tag kind="MERITEV">{MOCK.station} · {MOCK.now.time}</Tag>
        <div className="w-plant"><Plant stage={drops} size={40} /></div>
      </div>
      <div className="w42">
        <div className="w42-main">
          <span className="w-verdict"><span className="level-ico" style={{ background: l.color }}>{l.icon}</span>{l.word.toUpperCase()}</span>
          <span className="w-pm"><b>{MOCK.now.pm25}</b> µg/m³ <small>fini delci PM2,5 · {l.word.toLowerCase()} je {levelRange(l)}</small></span>
          <WidgetScale pm={MOCK.now.pm25} />
          <span className="w-advice">{MOCK.now.advice}</span>
          <Tag kind="MERITEV">{MOCK.station} · {MOCK.now.time}</Tag>
        </div>
        <div className="w42-side"><Plant stage={drops} size={48} /><span>{tasksLeft}</span></div>
      </div>
    </div>
  )
}

/* ============================================================================
 * Domov ("Igra")
 * ========================================================================== */
function Liga({ weekPoints }) {
  const table = Object.entries({ ...MOCK.league, [MOCK.myCetrt]: MOCK.league[MOCK.myCetrt] + weekPoints })
    .map(([name, pts]) => ({ name, pts }))
    .sort((a, b) => b.pts - a.pts)
  const me = table.findIndex((r) => r.name === MOCK.myCetrt)
  const show = new Set(table.map((_, i) => i)) // ves seznam: liga ima svoj zavihek
  const rows = []
  let prev = -1
  ;[...show].sort((a, b) => a - b).forEach((i) => {
    if (i - prev > 1) rows.push({ gap: true, key: `g${i}` })
    rows.push({ ...table[i], rank: i + 1, key: table[i].name })
    prev = i
  })
  if (prev < table.length - 1) rows.push({ gap: true, key: 'gend' })
  const zone = (rank) => (rank <= 3 ? 'up' : rank > table.length - 3 ? 'down' : '')
  return (
    <section className="card">
      <div className="row-between">
        <h2 className="h3">Liga četrtnih skupnosti</h2>
        <span className="muted small">ta teden</span>
      </div>
      <p className="body">{MOCK.myCetrt} je <b>{me + 1}. od {table.length}</b></p>
      <ol className="league">
        {rows.map((r) =>
          r.gap ? <li key={r.key} className="gap" aria-hidden="true">⋯</li> : (
            <li key={r.key} className={`${r.name === MOCK.myCetrt ? 'me' : ''} ${zone(r.rank)}`}>
              <span className="rank">{r.rank}</span>
              <span className="name">{r.name}</span>
              {zone(r.rank) === 'up' && <span className="zone" aria-label="cona napredovanja">▲</span>}
              {zone(r.rank) === 'down' && <span className="zone" aria-label="cona izpada">▼</span>}
              <span className="pts">{fmt(r.pts)}</span>
            </li>
          ),
        )}
      </ol>
      <p className="muted small">▲ prvi trije napredujejo · ▼ zadnji trije izpadejo · lestvica po točkah igre, ne po kakovosti zraka</p>
    </section>
  )
}

function Home({ done, onOpen, weekPoints, streak, xp }) {
  const drops = Object.keys(done).length
  return (
    <div className="screen home">
      <header className="hero">
        <Plant stage={drops} size={176} />
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
            {streak} dni zapored
          </span>
          <span className="muted small">{xp % MOCK.xpPerLevel} / {MOCK.xpPerLevel} XP</span>
        </div>
        <div className="xp" role="progressbar" aria-valuenow={xp % MOCK.xpPerLevel} aria-valuemax={MOCK.xpPerLevel}>
          <div style={{ width: `${((xp % MOCK.xpPerLevel) / MOCK.xpPerLevel) * 100}%` }} />
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

      <section className="card vs">
        <div className="row-between">
          <b className="h3">Ti proti modelu</b>
          <b className="h3">{MOCK.vsModel.me} : {MOCK.vsModel.model}</b>
        </div>
        <p className="muted small">Pri nalogi Napoved ugibaš jutrišnji zrak. Vsak dan primerjamo tvojo napoved in napoved računalniškega modela CAMS z izmerjeno vrednostjo ARSO. Kdor je bliže, dobi točko. Ta teden: ti {MOCK.vsModel.me}, model {MOCK.vsModel.model}.</p>
      </section>
    </div>
  )
}

/* ============================================================================
 * Glavna komponenta
 * ========================================================================== */
export default function IgraPrototip({ initialProfile = 'nihce' }) {
  const [view, setView] = useState('home')
  const [done, setDone] = useState({}) // key -> rezultat naloge
  const [profile, setProfile] = useState(initialProfile)
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [widget, setWidget] = useState(false)
  const scroller = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [view])

  const points = { napoved: 150, kviz: (done.kviz?.correct ?? 0) * 30, beseda: done.beseda?.solved ? (7 - done.beseda.rows.length) * 10 : 0, dih: 0 }
  const weekPoints = Object.keys(done).reduce((s, k) => s + (points[k] ?? 0), 0)
  const streak = MOCK.streakDays + (Object.keys(done).length > 0 ? 1 : 0)
  const xp = MOCK.xp + weekPoints + Object.keys(done).length * 10
  const finish = (key) => (result) => setDone((d) => ({ ...d, [key]: result }))
  const back = () => setView('home')

  return (
    <div className="stage">
      <div className="controls" role="toolbar" aria-label="Nastavitve prototipa">
        <button className="ctl" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Svetli način' : 'Temni način'}</button>
        <button className="ctl" onClick={() => setWidget(!widget)} aria-pressed={widget}>{widget ? 'Skrij widget' : 'Pokaži widget'}</button>
        <button className="ctl" onClick={() => { setDone({}); setView('home') }}>Ponastavi dan</button>
      </div>

      <div className="layout">
        <div className="phone">
          <div className="phone-scroll" ref={scroller}>
            {view === 'home' && <Home done={done} onOpen={setView} weekPoints={weekPoints} streak={streak} xp={xp} />}
            {view === 'napoved' && <Napoved onBack={back} onDone={finish('napoved')} done={!!done.napoved} saved={done.napoved} />}
            {view === 'kviz' && <Kviz onBack={back} onDone={finish('kviz')} done={!!done.kviz} saved={done.kviz} />}
            {view === 'beseda' && <Beseda onBack={back} onDone={finish('beseda')} done={!!done.beseda} saved={done.beseda} />}
            {view === 'dih' && <Dih onBack={back} onDone={finish('dih')} done={!!done.dih} profile={profile} onProfile={setProfile} />}
            {view === 'tab-Liga' && <div className="screen"><h1 className="h1">Liga</h1><Liga weekPoints={weekPoints} /></div>}
            {view.startsWith('tab-') && view !== 'tab-Liga' && (
              <div className="screen"><h1 className="h1">{view.slice(4)}</h1><p className="body muted">V tem prototipu deluje samo zavihek Igra.</p></div>
            )}
          </div>
          <nav className="tabbar" aria-label="Glavni zavihki">
            {['Zdaj', 'Zemljevid', 'Igra', 'Liga', 'Opozorila'].map((t) => {
              const active = t === 'Igra' ? !view.startsWith('tab-') : view === `tab-${t}`
              return (
                <button key={t} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined} onClick={() => setView(t === 'Igra' ? 'home' : `tab-${t}`)}>
                  <TabIcon name={t} />
                  {t}
                </button>
              )
            })}
          </nav>
        </div>
        {widget && <Widgets drops={Object.keys(done).length} />}
      </div>
    </div>
  )
}

function TabIcon({ name }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'Zdaj' && <path {...p} d="M3 10 12 3l9 7v10H3V10ZM9 20v-7h6v7" />}
      {name === 'Zemljevid' && <path {...p} d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6ZM9 4v14M15 6v14" />}
      {name === 'Igra' && (<><rect {...p} x="3" y="7" width="18" height="11" rx="4" /><path {...p} d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" /></>)}
      {name === 'Liga' && <path {...p} d="M8 4h8v6a4 4 0 0 1-8 0V4ZM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 14v3M8 20h8M9.5 17h5" />}
      {name === 'Opozorila' && <path {...p} d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0" />}
    </svg>
  )
}

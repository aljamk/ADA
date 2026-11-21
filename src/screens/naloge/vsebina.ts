// Content of the daily tasks: quiz questions, words, breathing paces. Facts come from ARSO measurements 2016–2026.
import type { ProfileKey } from '../../profile'

export interface Level {
  key: string
  word: string
  color: string
  icon: string
  max: number
}

/** Learning scale in µg/m³ (same bands as LEARN in aqi.ts), with colour + icon + word */
export const LEVELS: Level[] = [
  { key: 'dobro', word: 'Dobro', color: '#3BB273', icon: '✓', max: 15 },
  { key: 'zmerno', word: 'Zmerno', color: '#F2C94C', icon: '–', max: 25 },
  { key: 'slabo', word: 'Slabo', color: '#F2994A', icon: '▲', max: 50 },
  { key: 'zeloslabo', word: 'Zelo slabo', color: '#E5484D', icon: '!', max: 75 },
  { key: 'nevarno', word: 'Nevarno', color: '#8E4EC6', icon: '!!', max: 100 },
]
export const levelOf = (pm: number) => LEVELS.find((l) => pm < l.max) ?? LEVELS[LEVELS.length - 1]

export const TASKS: { key: 'napoved' | 'kviz' | 'beseda' | 'dih'; title: string; sub: string; time: string; reward: string; icon: string }[] = [
  { key: 'napoved', title: 'Napoved', sub: 'Kakšen bo zrak jutri?', time: '1 min', reward: 'Kapljica + točke za četrt', icon: 'forecast' },
  { key: 'kviz', title: 'Kviz', sub: 'Pet vprašanj', time: '2 min', reward: 'Kapljica + točke', icon: 'quiz' },
  { key: 'beseda', title: 'Beseda dneva', sub: 'Ugani besedo', time: '2 min', reward: 'Kapljica + točke', icon: 'word' },
  { key: 'dih', title: 'Dih', sub: 'Minuta mirnega dihanja', time: '1–2 min', reward: 'Samo kapljica', icon: 'breath' },
]

export const QUIZ_SOURCE = 'Vir: meritve ARSO 2016–2026'
export const QUIZ = [
  { q: 'Kdaj je pozimi zrak v Ljubljani najslabši?', a: ['Zjutraj ob 7h', 'Opoldne', 'Zvečer med 21. in 23. uro'], correct: 2, why: 'Zvečer se ogrevanje in promet ujameta pod inverzijo, zato delci dosežejo vrh med 21. in 23. uro.' },
  { q: 'Kaj je inverzija?', a: ['Topel zrak nad hladnim, ki zapre kotlino', 'Močan veter z gora', 'Dež, ki spere delce'], correct: 0, why: 'Pri inverziji topla plast nad kotlino deluje kot pokrov, zato delci ostanejo pri tleh.' },
  { q: 'Kateri vir pozimi največ prispeva k delcem v Ljubljani?', a: ['Tovarne', 'Kurjenje drv v pečeh', 'Letala'], correct: 1, why: 'Male kurilne naprave na les so pozimi glavni vir drobnih delcev v kotlini.' },
  { q: 'Kdaj je pozimi najbolje prezračiti stanovanje?', a: ['Pozno zvečer', 'Sredi dneva, na kratko', 'Ponoči z odprtim oknom'], correct: 1, why: 'Sredi dneva je zrak običajno najčistejši, kratko in močno zračenje pa zamenja zrak hitro.' },
  { q: 'Kje je ob prometni konici zrak navadno slabši?', a: ['Ob glavni cesti', 'V parku', 'Enako povsod'], correct: 0, why: 'Ob prometnih cestah je dušikovega dioksida in delcev več kot nekaj ulic stran.' },
  { q: 'Kako velik je delec PM2,5?', a: ['Kot zrno peska', 'Približno 30-krat tanjši od lasu', 'Viden s prostim očesom'], correct: 1, why: 'PM2,5 pomeni delce, manjše od 2,5 mikrometra. Človeški las je debel okoli 70 mikrometrov.' },
  { q: 'Koliko zim od desetih je imela Ljubljana inverzijo v več kot petini ur?', a: ['Nobene', 'Skoraj vse', 'Samo eno'], correct: 1, why: 'Pozimi je bila inverzija v Ljubljani prisotna v približno 21 % ur.' },
  { q: 'Kaj je meja EU za PM2,5 od leta 2030?', a: ['10 µg/m³ letno povprečje', '50 µg/m³ letno povprečje', 'Meje ni'], correct: 0, why: 'Nova direktiva EU znižuje letno mejo za PM2,5 na 10 µg/m³. Ljubljana ima povprečje okoli 14.' },
]

export const WORDS = ['MEGLA', 'DELCI', 'VETER', 'KISIK', 'IZDIH', 'BURJA', 'PEČKA', 'PELOD', 'OBLAK', 'ASTMA']
export const WORD_FACTS: Record<string, string> = {
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
}

export interface Breath {
  label: string
  inhale: number
  exhale: number
  minutes: number
  seated?: boolean
  large?: boolean
  inWord: string
  outWord: string
}
/** Breathing pace per onboarding profile */
export const BREATH: Record<ProfileKey, Breath> = {
  nihce: { label: 'Nihče posebej', inhale: 4, exhale: 6, minutes: 2, inWord: 'Vdihni', outWord: 'Izdihni' },
  astma: { label: 'Astma', inhale: 2, exhale: 4, minutes: 1, inWord: 'Vdihni skozi nos', outWord: 'Izdihni skozi stisnjene ustnice' },
  nosecnost: { label: 'Nosečnost', inhale: 4, exhale: 6, minutes: 1, seated: true, inWord: 'Vdihni', outWord: 'Izdihni' },
  starejsi: { label: 'Starejši', inhale: 3, exhale: 5, minutes: 1, seated: true, large: true, inWord: 'Vdihni', outWord: 'Izdihni' },
  otroci: { label: 'Otroci', inhale: 3, exhale: 4, minutes: 1, inWord: 'Vdihni', outWord: 'Izdihni' },
}

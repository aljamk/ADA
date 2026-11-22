import { useEffect, useState } from 'react'
import { usAqi } from '../aqi'
import { ofDay, type Forecast } from '../forecast'
import { dateStr, hh } from '../time'
import { fetchVreme, LEVEL_COLOR, LEVEL_TEXT, oceniDneve, type Vreme } from '../opozorilo'

// Schematic cartogram of the 17 četrtne skupnosti (Figma node 29:2069), positions in a 342-px-wide card.
const HEX = [
  { id: 'ŠG', name: 'Šmarna gora', x: 96, y: 47 },
  { id: 'ŠE', name: 'Šentvid', x: 146, y: 47 },
  { id: 'ČR', name: 'Črnuče', x: 196, y: 47 },
  { id: 'DR', name: 'Dravlje', x: 71, y: 78 },
  { id: 'PO', name: 'Posavje', x: 121, y: 78 },
  { id: 'BE', name: 'Bežigrad', x: 171, y: 78 },
  { id: 'JA', name: 'Jarše', x: 221, y: 78 },
  { id: 'RO', name: 'Rožnik', x: 46, y: 109 },
  { id: 'ŠI', name: 'Šiška', x: 96, y: 109 },
  { id: 'CE', name: 'Center', x: 146, y: 109 },
  { id: 'MO', name: 'Moste', x: 196, y: 109 },
  { id: 'PL', name: 'Polje', x: 246, y: 109 },
  { id: 'VI', name: 'Vič', x: 71, y: 140 },
  { id: 'TR', name: 'Trnovo', x: 121, y: 140 },
  { id: 'GO', name: 'Golovec', x: 171, y: 140 },
  { id: 'SO', name: 'Sostro', x: 221, y: 140 },
  { id: 'RU', name: 'Rudnik', x: 146, y: 171 },
]

// Sequential scale, one hue light → dark (lower → higher relative exposure)
const SCALE = ['#f6efd9', '#f0dfae', '#ecc97a', '#e3ad4a', '#d08a2a']

interface Cetrt {
  ime: string
  rel: number // exposure index relative to the city average (1.0)
  vir: string
  vrsta: string // "meritev" or "ocena (umerjen senzor)"
}
/** public/data/viri.json (scripts/build_viri.py): local PM10 contribution of heating and traffic by hour of day */
interface Viri {
  b_kurisca: number
  c_promet: number
  cetrti: Record<string, { kurisca: (number | null)[]; promet: (number | null)[] }>
}
const sumHours = (xs: (number | null)[], from: number, to: number) => xs.slice(from, to + 1).reduce<number>((s, v) => s + (v ?? 0), 0)

interface Ustanova {
  vrsta: string
  ime: string
  cetrt: string
}

const fmt = (v: number) => v.toFixed(1).replace('.', ',')
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Tomorrow's hours (6–22h) where the model goes above AQI 100, as one window "6–10h". */
export function publicNoticeWindow(fc?: Forecast) {
  if (!fc) return null
  const tomorrow = dateStr(new Date(Date.now() + 86400000))
  const bad = ofDay(fc, tomorrow).filter((h) => {
    const hour = Number(hh(h.time))
    return hour >= 6 && hour <= 22 && usAqi(h.value) > 100
  })
  if (!bad.length) return null
  return `${Number(hh(bad[0].time))}–${Number(hh(bad[bad.length - 1].time)) + 1}h`
}

/** 08 · Za odločevalce */
export default function Odlocevalci({ fc, onBack }: { fc?: Forecast; onBack: () => void }) {
  const [sel, setSel] = useState('Šiška')
  const [cetrti, setCetrti] = useState<Cetrt[]>([])
  const [ustanove, setUstanove] = useState<Ustanova[]>([])
  const [vreme, setVreme] = useState<Vreme | null>(null)
  const [vremeErr, setVremeErr] = useState(false)
  const [warnInfo, setWarnInfo] = useState(false) // the explanation behind the round i
  const [viri, setViri] = useState<Viri | null>(null)
  const [viriInfo, setViriInfo] = useState(false)

  // Built from the data package by scripts/build_data.py
  useEffect(() => {
    fetch('/data/cetrti.json').then((r) => r.json()).then(setCetrti).catch(() => {})
    fetch('/data/ustanove.json').then((r) => r.json()).then(setUstanove).catch(() => {})
    fetchVreme().then(setVreme).catch(() => setVremeErr(true))
    fetch('/data/viri.json').then((r) => r.json()).then(setViri).catch(() => {})
  }, [])

  // Where the particles come from in the selected četrt: heating vs traffic, by hour (winter, GRAL 2021)
  const vir = viri?.cetrti[Object.keys(viri.cetrti).find((k) => same(k, sel)) ?? ''] ?? null
  const share = (from: number, to: number) => {
    if (!vir) return null
    const k = sumHours(vir.kurisca, from, to)
    const p = sumHours(vir.promet, from, to)
    return k + p > 0 ? Math.round((k / (k + p)) * 100) : null
  }
  const eveningHeating = share(18, 23)
  const morningHeating = share(6, 9)
  const virMax = vir ? Math.max(1, ...vir.kurisca.map((v, h) => (v ?? 0) + (vir.promet[h] ?? 0))) : 1

  // Early warning: the next days from the weather rule and the model threshold (src/opozorilo.ts)
  const dnevi = oceniDneve(vreme, fc)
  const worst = Math.max(...dnevi.map((d) => d.level)) as 0 | 1 | 2
  const fmtDate = (d: string) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.`
  // Whom to notify first: the četrti with the most sensitive institutions, weighted by exposure
  const notify = cetrti
    .map((c) => ({ ime: c.ime, n: ustanove.filter((u) => same(u.cetrt, c.ime)).length, rel: c.rel }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n * b.rel - a.n * a.rel)
    .slice(0, 3)

  const data = (name: string) => cetrti.find((c) => same(c.ime, name))
  const rels = cetrti.map((c) => c.rel).sort((a, b) => a - b)
  const colorOf = (rel?: number) => {
    if (rel == null || !rels.length) return 'var(--soft)'
    const q = rels.findIndex((r) => r >= rel) / rels.length // quantile 0..1
    return SCALE[Math.min(SCALE.length - 1, Math.floor(q * SCALE.length))]
  }

  const selected = data(sel)
  // One institution of each kind, each in a different četrt, most exposed first
  const used = new Set<string>()
  const top = ['Vrtec', 'Šola', 'Dom starejših'].flatMap((kind) => {
    const u = ustanove
      .filter((x) => x.vrsta === kind && !used.has(x.cetrt))
      .map((x) => ({ ...x, rel: data(x.cetrt)?.rel ?? 0 }))
      .sort((a, b) => b.rel - a.rel)[0]
    if (!u) return []
    used.add(u.cetrt)
    return [u]
  })

  const window = publicNoticeWindow(fc)
  const prepare = async () => {
    const jutri = dnevi[1]
    const text = jutri.level > 0
      ? `Opozorilo: jutri (${fmtDate(jutri.date)}) je v Ljubljani ${jutri.level === 2 ? 'verjetno' : 'mogoče'} slab zrak${window ? `, najslabše med ${window}` : ''}. Napoved, ne meritev: vremenska napoved in model CAMS, umerjen na meritve ARSO. Občutljive skupine naj omejijo daljši napor na prostem; zvečer ne kurite v starih pečeh.`
      : `Jutri (${fmtDate(jutri.date)}) ne pričakujemo slabega zraka (napoved vremena in modela CAMS).`
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
          <p className="t-label">Ljubljana · vir: ARSO, OSM</p>
          <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>Za odločevalce</p>
        </div>
        <button className="link" style={{ fontSize: 14, paddingBottom: 6 }} onClick={onBack}>‹ Nazaj</button>
      </div>

      <section className="card" style={{ background: 'var(--info)' }}>
        <div className="section-head" style={{ marginTop: 0 }}>
          <span className="chip model">NAPOVED</span>
          <button className="info-btn" aria-label="Kako nastane opozorilo?" aria-expanded={warnInfo} onClick={() => setWarnInfo(!warnInfo)}>
            i
          </button>
        </div>
        {warnInfo && (
          <div className="map-info" style={{ marginTop: 12 }}>
            <p className="t-small">
              <b>Kako nastane opozorilo?</b>
              <br />
              Dva znaka iz podatkovnega paketa: vremensko pravilo (veter pod 6 km/h, mejna plast pod 300 m, brez padavin) in model CAMS, umerjen na meritve ARSO, z dnevno vrednostjo nad 25 µg/m³. En znak pomeni, da je slab zrak možen, oba, da je verjeten.
            </p>
            <p className="t-small">
              <b>Kako zanesljivo?</b>
              <br />
              Vremensko pravilo ujame okoli tri četrtine preseganj, a so tri četrtine opozoril lažne, ker je preseganje redek dogodek. Prag modela ujame 94 % preseganj s 70 % lažnih opozoril. Zato je to napoved za pripravo, ne potrditev.
            </p>
          </div>
        )}
        <div className="rows" style={{ marginTop: 10, gap: 8 }}>
          {dnevi.map((d) => (
            <div key={d.date} className="warn-day">
              <span className="dot" style={{ background: LEVEL_COLOR[d.level] }} />
              <span>
                <b>{d.label} · {fmtDate(d.date)}</b>
                <span className="t-body" style={{ display: 'block' }}>{d.stagnant == null && d.modelWarn == null ? (vremeErr ? 'Vremenska napoved ni dosegljiva.' : 'Nalagam…') : LEVEL_TEXT[d.level]}</span>
                <span className="t-small warn-facts">
                  {d.wind != null && d.blh != null && d.rain != null ? (
                    <>
                      <span>Veter {Math.round(d.wind)} km/h</span>
                      <span>Mejna plast {Math.round(d.blh)} m</span>
                      <span>{d.rain < 0.5 ? 'Brez padavin' : `Padavine ${d.rain.toFixed(1).replace('.', ',')} mm`}</span>
                    </>
                  ) : (
                    <span>Vreme: ni podatka</span>
                  )}
                  <span>{d.model != null ? `Model ${d.model} µg/m³` : 'Model: ni napovedi za ta dan'}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
        {worst > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="t-label">Predlog ukrepa</p>
            <p className="t-body" style={{ marginTop: 6 }}>
              Do 18h obvesti vrtce, šole in domove za starejše{notify.length ? ` v četrtih ${notify.map((c) => c.ime).join(', ')}` : ''} (večerni vrh delcev je med 21h in 23h).
              {worst === 2 ? ' Objavi poziv, naj se zvečer ne kuri v starih pečeh, in pripravi omejitev prometa v središču.' : ' Pripravi besedilo obvestila za primer, da se napoved potrdi.'}
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <div className="now-top">
          <p className="t-h3">Izpostavljenost</p>
          <span className="t-label">Ocena</span>
        </div>
        <div className="hexes">
          {HEX.map((h) => {
            const d = data(h.name)
            return (
              <button
                key={h.id}
                className={h.name === sel ? 'hex sel' : 'hex'}
                style={{ left: `${((h.x - 16) / 310) * 100}%`, top: h.y - 47, ['--fill' as string]: colorOf(d?.rel) }}
                onClick={() => setSel(h.name)}
                aria-label={`${h.name}: ${d ? fmt(d.rel) : 'ni podatka'}`}
                title={d ? `${h.name}: ${fmt(d.rel)} · PM2,5 vir: ${d.vir}` : h.name}
              >
                <span>{h.id}</span>
              </button>
            )
          })}
        </div>
        <div className="now-top" style={{ marginTop: 6 }}>
          <b style={{ fontSize: 14 }}>{selected ? `${selected.ime}: ${fmt(selected.rel)} · OCENA` : sel}</b>
          <span className="t-small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Nižje
            {SCALE.map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
            višje
          </span>
        </div>
        <p className="t-small" style={{ fontSize: 10, marginTop: 6 }}>
          Indeks iz stavb, omrežij, reliefa in meritev (zvezek 04) · 1,0 = povprečje mesta · ne AQI
          {selected && ` · PM2,5: ${selected.vrsta === 'meritev' ? 'meritev' : 'ocena'} (${selected.vir})`}
        </p>
      </section>

      <section className="card">
        <div className="section-head" style={{ marginTop: 0 }}>
          <p className="t-h3">Od kod delci: {sel}</p>
          <button className="info-btn" aria-label="Kako nastane ta ocena?" aria-expanded={viriInfo} onClick={() => setViriInfo(!viriInfo)}>
            i
          </button>
        </div>
        <span className="chip model" style={{ marginTop: 8 }}>OCENA · MODEL GRAL</span>
        {viriInfo && (
          <div className="map-info" style={{ marginTop: 10 }}>
            <p className="t-small">
              <b>Od kod ocena?</b>
              <br />
              Model GRAL (ARSO) za leto 2021 loči, koliko delcev PM10 v četrti dodajo mala kurišča in koliko osebni promet, po urah. Prikazane so zimske ure (januar–marec, oktober–december), umerjene na meritve postaje Bežigrad.
            </p>
            <p className="t-small">
              <b>Kaj ne vidimo?</b>
              <br />
              Samo lokalni prispevek obeh virov; ozadje iz regije (11–19 µg/m³) ni vključeno. Jutranji vrh, ki ga model napove, se v meritvah ne pozna; večerni se ujema s kurišči.
            </p>
          </div>
        )}
        {!vir ? (
          <p className="t-body t-2" style={{ marginTop: 10 }}>{viri ? 'Za to četrt ni podatka (zunaj mreže modela).' : 'Nalagam…'}</p>
        ) : (
          <>
            <p className="t-body" style={{ marginTop: 10 }}>
              <b>Zvečer (18–23h): {eveningHeating ?? '–'} % kurišča.</b>
              <br />
              <b>Zjutraj (6–9h): {morningHeating != null ? 100 - morningHeating : '–'} % promet.</b>
            </p>
            <div className="viri-grid" role="img" aria-label={`Prispevek kurišč in prometa po urah v četrti ${sel}`}>
              {vir.kurisca.map((k, h) => (
                <div key={h} className="viri-col" title={`${h}h: kurišča ${k ?? 0} µg/m³, promet ${vir.promet[h] ?? 0} µg/m³`}>
                  <span className="viri-k" style={{ height: `${((k ?? 0) / virMax) * 100}%` }} />
                  <span className="viri-p" style={{ height: `${((vir.promet[h] ?? 0) / virMax) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="viri-ticks">{[0, 6, 12, 18].map((h) => <span key={h} style={{ left: `${((h + 0.5) / 24) * 100}%` }}>{h}h</span>)}<span style={{ left: '98%' }}>23h</span></div>
            <div className="fc-legend" style={{ marginTop: 6 }}>
              <span>Prispevek k PM10, µg/m³</span>
              <span><i><b style={{ background: '#f2994a' }} />Kurišča</i><i><b style={{ background: '#7ec8e3' }} />Promet</i></span>
            </div>
            <p className="t-body" style={{ marginTop: 10 }}>
              {eveningHeating != null && eveningHeating >= 60
                ? 'Zvečer odločajo kurišča: ukrep, ki cilja pravi vir, je zamenjava starih peči in obveščanje o kurjenju.'
                : eveningHeating != null && eveningHeating <= 40
                  ? 'Zvečer prevladuje promet: učinkovit ukrep je omejitev prometa, ne peči.'
                  : 'Zvečer sta vira približno enakovredna: ukrep naj cilja oba.'}
              {morningHeating != null && 100 - morningHeating >= 50 ? ' Zjutraj prevladuje promet: šolske ulice in omejitve ob konicah.' : ''}
            </p>
          </>
        )}
      </section>

      <p className="t-sub">Občutljive ustanove</p>
      <div className="inst">
        {top.map((u) => (
          <div key={u.ime} className="card" title={u.ime}>
            <span className="t-body" style={{ fontWeight: 500 }}>{u.vrsta} · {u.cetrt}</span>
            <span>
              <b>{fmt(u.rel)}</b>
              <small>OCENA</small>
            </span>
          </div>
        ))}
      </div>
      <button className="btn" style={{ height: 52 }} onClick={prepare}>Pripravi obvestilo</button>
    </div>
  )
}

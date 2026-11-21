import { useEffect, useState } from 'react'
import { usAqi } from '../aqi'
import { ofDay, type Forecast } from '../forecast'
import { dateStr, hh } from '../time'

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

  // Built from the data package by scripts/build_data.py
  useEffect(() => {
    fetch('/data/cetrti.json').then((r) => r.json()).then(setCetrti).catch(() => {})
    fetch('/data/ustanove.json').then((r) => r.json()).then(setUstanove).catch(() => {})
  }, [])

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
    const text = window
      ? `Obvestilo: jutri med ${window} se pričakuje slabši zrak (napoved modela CAMS, umerjena na meritve ARSO). Občutljive skupine naj omejijo daljši napor na prostem.`
      : 'Jutri ne pričakujemo slabšega zraka (napoved modela CAMS).'
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
        <p className="t-label">Model · jutri</p>
        <p className="t-h3" style={{ marginTop: 10 }}>
          {!fc ? 'Nalagam napoved…' : window ? `Priporočamo obvestilo javnosti: jutri ${window}.` : 'Jutri obvestilo javnosti ni potrebno.'}
        </p>
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

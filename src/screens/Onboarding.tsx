import { useState } from 'react'
import { Golob2D } from '../components/Golob'
import { cleanProfiles, PROFILES, type ProfileKey } from '../profile'

// Landscape illustration layers, positioned exactly as in Figma node 29:73 (insets in %).
const LAYERS: [string, string][] = [
  ['land-frame', '0'],
  ['land-ridgeline', '21.88% 0 20.63% 0'],
  ['land-backhills', '43.72% 0 0 0'],
  ['land-castle', '31.87% 27.49% 41.25% 58.63%'],
  ['land-castlehill', '54.13% 0 0 38.74%'],
  ['land-river', '67.5% 34.94% 0 26.75%'],
  ['land-lefthill', '58.45% 59.36% 0 0'],
  ['land-forest', '52.44% 7.16% 15.63% 8.58%'],
  ['land-banks', '75.59% 0 0 0'],
]

export function Landscape() {
  return (
    <div className="landscape" aria-hidden>
      {LAYERS.map(([name, inset]) => (
        <img key={name} src={`/figma/${name}.svg`} alt="" style={{ inset }} />
      ))}
    </div>
  )
}

/** 01 · Dobrodošli: optional profile, no account, nothing leaves the device. */
export default function Onboarding({ onDone }: { onDone: (p: ProfileKey[]) => void }) {
  const [pick, setPick] = useState<ProfileKey[]>([])
  // Several groups can be chosen (e.g. older and asthma); "Nihče posebej" clears the others
  const toggle = (k: ProfileKey) =>
    setPick((cur) => (k === 'nihce' ? ['nihce'] : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur.filter((x) => x !== 'nihce'), k]))
  return (
    <div className="screen" style={{ paddingTop: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="link" onClick={() => onDone(['nihce'])}>
          Preskoči
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.2 }}>Zrak</p>
        <Golob2D size={88} />
      </div>
      <div>
        <p className="t-title">
          Veš, kaj dihaš.
          <br />
          Veš, kdaj ven.
        </p>
        <p className="t-body t-2" style={{ marginTop: 8 }}>
          Jasen pogled na zrak
          <br />v Ljubljanski kotlini.
        </p>
      </div>
      <Landscape />
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>Komu prilagodimo nasvete?</p>
      <div className="choices">
        {PROFILES.map((p) => (
          <button
            key={p.key}
            className={`choice${p.key === 'nihce' ? ' wide' : ''}${pick.includes(p.key) ? ' on' : ''}`}
            onClick={() => toggle(p.key)}
          >
            {p.label}
            {pick.includes(p.key) && <b>✓</b>}
          </button>
        ))}
      </div>
      <p className="t-body t-2">Lahko izbereš več skupin. Izbira je neobvezna in ostane na napravi.</p>
      <p className="t-body" style={{ fontWeight: 500 }}>
        Brez računa. Brez vnosa
        <br />
        osebnih podatkov.
      </p>
      <div className="bottom-bar">
        <button className="btn" onClick={() => onDone(cleanProfiles(pick))}>
          Pokaži moj zrak
        </button>
      </div>
    </div>
  )
}

import type { LevelKey } from '../aqi'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

// Golob: the Ljubljana pigeon mascot drawn in Figma (node 95:97). Two faces: calm and, when the
// day's tasks are not done, red-eyed. The red-eyed one is for the home-screen widget.
export const GOLOB = '/golob.png'
export const GOLOB_RDECE = '/golob-rdece.png'

/** Flat 2D pigeon (splash, onboarding, small places) */
export function Golob2D({ size = 120, red = false, className, style }: { size?: number; red?: boolean; className?: string; style?: CSSProperties }) {
  return <img src={red ? GOLOB_RDECE : GOLOB} alt="" width={size} height={Math.round(size * 1.25)} className={className} style={style} draggable={false} />
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * "3D" pigeon: the drawing stacked in a few depth layers inside a perspective box, so it has
 * thickness, a ground shadow and turns towards the finger (or with the phone's tilt). Idle: a slow
 * sway and bob. Not a real 3D model; respects reduced motion.
 */
export function Golob3D({ size = 150, red = false, line }: { size?: number; red?: boolean; line?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (reduced() || typeof DeviceOrientationEvent === 'undefined') return
    const on = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      setTilt({ x: Math.max(-20, Math.min(20, e.gamma)), y: Math.max(-12, Math.min(12, (e.beta - 45) / 3)) })
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [])

  const onMove = (e: React.PointerEvent) => {
    if (reduced() || !box.current) return
    const r = box.current.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: nx * 36, y: -ny * 20 })
  }
  const layers = 6
  const src = red ? GOLOB_RDECE : GOLOB
  const h = Math.round(size * 1.25)
  const style = tilt ? { transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`, animation: 'none' } : undefined
  return (
    <div className="golob3d" ref={box} onPointerMove={onMove} onPointerLeave={() => setTilt(null)} style={{ width: size, height: h + 18 }} aria-label={red ? 'Golob z rdečimi očmi: naloge čakajo' : 'Golob, maskota'}>
      <div className="golob3d-body" style={{ width: size, height: h, ...style }}>
        {Array.from({ length: layers }, (_, i) => (
          <img key={i} src={src} alt="" width={size} height={h} draggable={false} style={{ transform: `translateZ(${(i - layers + 1) * 3}px)`, filter: i === layers - 1 ? 'none' : `brightness(${0.55 + (i / layers) * 0.35})` }} />
        ))}
      </div>
      <span className="golob3d-shadow" style={{ width: size * 0.7 }} />
      {line && <span className="golob3d-line">{line}</span>}
    </div>
  )
}

/** Golob with a speech bubble, for Opozorila, Četrti and other places where he comments */
export function GolobRece({ text, size = 72, red = false }: { text: string; size?: number; red?: boolean }) {
  return (
    <div className="golob-rece">
      <Golob2D size={size} red={red} />
      <p className="golob-bubble" aria-live="polite">{text}</p>
    </div>
  )
}

/**
 * Golob in the fog (Igra): with no task done he is barely visible through thick haze; every finished
 * task clears a quarter of the fog. Fog = polluted air; a clear pigeon = a clear day.
 */
export function GolobMegla({ done, total = 4, size = 170, line }: { done: number; total?: number; size?: number; line?: string }) {
  const fog = Math.max(0, Math.min(1, (total - done) / total))
  const h = Math.round(size * 1.25) + 18
  return (
    <div className="golob-megla" style={{ width: size + 60, height: h + 24 }} role="img" aria-label={done >= total ? 'Golob v čistem zraku' : `Golob v megli, ${done} od ${total} nalog`}>
      {line && <span className="golob3d-line golob-megla-line">{line}</span>}
      <div className="golob-megla-body" style={{ filter: `blur(${(fog * 2.2).toFixed(1)}px) saturate(${(1 - fog * 0.55).toFixed(2)}) brightness(${(1 - fog * 0.15).toFixed(2)})` }}>
        <Golob3D size={size} />
      </div>
      <div className="megla" style={{ opacity: fog * 0.96 }} aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  )
}

/**
 * The pigeon acting out the air quality (Zdaj, under the advice) with its own wing: the drawing is split into
 * four layers on the same canvas (public/golob-telo.png, golob-glava.png = head and neck, golob-krilce.png = the
 * folded wing on the chest, golob-krilo.png = the raised wing; scripts/cut_wings.py). Only the notes and the nest are drawn extra.
 *  dobro      dances and flaps (notes)
 *  zmerno     stands still and bobs its head
 *  slabo      ruffles: puffs up and shakes its feathers
 *  zeloslabo  hunched: head pulled in, heavy breathing, both wings open and beating symmetrically
 *  nevarno    wing folded, hiding and trembling in a nest
 */
export function GolobRazpolozenje({ level, size = 170 }: { level: LevelKey; size?: number }) {
  const W = 900
  const H = 1127
  const caption: Record<LevelKey, string> = {
    dobro: 'Golob pleše: zrak je dober.',
    zmerno: 'Golob ziba z glavo: tako-tako.',
    slabo: 'Golob se ščeperi in otresa perje: zrak je slab.',
    zeloslabo: 'Golob je sključen, težko diha in prhuta z obema kriloma: zrak je zelo slab.',
    nevarno: 'Golob se skriva in trese v gnezdu: zrak je nevaren.',
  }
  return (
    <div className={`golob-mood ${level}`} style={{ width: size, height: (size * H) / W }} role="img" aria-label={caption[level]}>
      {level === 'nevarno' && (
        <svg className="golob-part nest-back" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <ellipse cx="450" cy="930" rx="430" ry="150" fill="#6e4a24" />
        </svg>
      )}
      <div className="golob-mood-figure">
        <img className="golob-layer telo" src="/golob-telo.png" alt="" draggable={false} />
        <img className="golob-layer glava" src="/golob-glava.png" alt="" draggable={false} />
        <img className="golob-layer krilce" src="/golob-krilce.png" alt="" draggable={false} />
        <img className="golob-layer krilo" src="/golob-krilo.png" alt="" draggable={false} />
        {level === 'zeloslabo' && (
          /* the same wing mirrored to the left side (behind the body), moving exactly like the right one */
          <div className="golob-mirror" aria-hidden="true">
            <img className="golob-layer krilo" src="/golob-krilo.png" alt="" draggable={false} />
          </div>
        )}
      </div>
      <svg className="golob-part" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {level === 'dobro' && (
          <g className="notes" fill="#f2c94c" fontSize="150" fontWeight="700">
            <text className="note n1" x="80" y="260">♪</text>
            <text className="note n2" x="700" y="120">♫</text>
            <text className="note n3" x="620" y="420">♪</text>
          </g>
        )}
        {level === 'nevarno' && (
          <g className="nest-front">
            <ellipse cx="450" cy="1010" rx="450" ry="210" fill="#8a5a2b" />
            <path d="M60 960 q120 -60 260 -20 t300 10 t260 -30" stroke="#b9823f" strokeWidth="16" fill="none" strokeLinecap="round" />
            <path d="M120 1030 q150 -40 300 0 t340 -10" stroke="#5c3b16" strokeWidth="14" fill="none" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  )
}

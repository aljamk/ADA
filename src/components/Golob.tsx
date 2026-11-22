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

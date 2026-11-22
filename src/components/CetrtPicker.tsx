import { levelOfPm } from '../aqi'
import { distanceKm, shortName, type Reading } from '../arso'
import { estimateFor, sourceFor, type Cetrt } from '../cetrti'
import { MAP_STATIONS } from '../screens/Zemljevid'

interface Props {
  cetrti: Cetrt[]
  readings: Reading[]
  value: string | null
  onPick: (name: string, at?: { lat: number; lon: number }) => void
  onClose: () => void
}

/**
 * Bottom sheet: choose your četrt (one of 17). Each row shows the current estimate for the četrt and the
 * source that will stand for it on Zdaj (an ARSO station or, when clearly closer, a citizen sensor).
 */
export default function CetrtPicker({ cetrti, readings, value, onPick, onClose }: Props) {
  const official = readings.filter((r) => MAP_STATIONS.some((s) => s.code === r.code) && r.pm25 != null)
  const list = [...cetrti].sort((a, b) => a.ime.localeCompare(b.ime, 'sl'))

  return (
    <div className="picker" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="t-sub">Izberi svojo četrt</p>
        <p className="t-small">17 četrtnih skupnosti Ljubljane · vrednost je ocena za četrt, vir je najbližja postaja ali senzor</p>
        <ul>
          {list.map((c) => {
            const pm = estimateFor(c, official)
            const src = sourceFor(c, readings)
            const d = src ? distanceKm(src.lat, src.lon, c.lat, c.lon) : null
            return (
              <li key={c.ime}>
                <button className={c.ime === value ? 'on' : ''} onClick={() => onPick(c.ime)}>
                  <span style={{ display: 'grid', gap: 2 }}>
                    <span className="name">{c.ime}</span>
                    {src && (
                      <span className="t-small" style={{ fontSize: 11 }}>
                        {src.kind === 'OCENA' ? '○ OCENA' : '● MERITEV'} · {shortName(src.name)}{d != null ? ` · ${d.toFixed(1).replace('.', ',')} km` : ''}
                      </span>
                    )}
                  </span>
                  {pm != null && (
                    <span className="t-2">
                      <span className="dot" style={{ background: levelOfPm(pm).color }} />
                      {pm} µg/m³
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {!list.length && <li className="t-2" style={{ padding: 12 }}>Nalagam četrti…</li>}
        </ul>
        <button className="btn-soft" onClick={onClose}>
          Zapri
        </button>
      </div>
    </div>
  )
}

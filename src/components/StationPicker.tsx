import { useState } from 'react'
import { levelOfPm } from '../aqi'
import { nearest, shortName, type Reading } from '../arso'
import { isCitizen } from '../sensors'

interface Props {
  readings: Reading[]
  value: string
  onPick: (code: string, at?: { lat: number; lon: number }) => void
  onClose: () => void
}

/** Bottom sheet: the Ljubljana stations as a short list, or use location once (no background tracking). */
export default function StationPicker({ readings, value, onPick, onClose }: Props) {
  const [locError, setLocError] = useState<string | null>(null)
  const list = [...readings.filter((r) => !isCitizen(r)), ...readings.filter(isCitizen)]

  const useLocation = () => {
    setLocError(null)
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const at = { lat: p.coords.latitude, lon: p.coords.longitude }
        onPick(nearest(readings, at.lat, at.lon).code, at)
      },
      () => setLocError('Lokacija ni na voljo. Izberi postajo ročno.'),
      { maximumAge: 600000, timeout: 10000 },
    )
  }

  return (
    <div className="picker" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="t-sub">Izberi postajo</p>
        <p className="t-small">Uradne postaje ARSO (● MERITEV) in občanski senzorji (○ OCENA) v Ljubljani</p>
        <button className="link" style={{ textAlign: 'left' }} onClick={useLocation}>
          Uporabi mojo lokacijo (enkrat, brez sledenja)
        </button>
        <ul>
          {locError && <li className="error">{locError}</li>}
          {list.map((r) => (
            <li key={r.code}>
              <button className={r.code === value ? 'on' : ''} onClick={() => onPick(r.code)}>
                <span className="name">{isCitizen(r) ? '○ ' : '● '}{shortName(r.name)}</span>
                {r.pm25 != null && (
                  <span className="t-2">
                    <span className="dot" style={{ background: levelOfPm(r.pm25).color }} />
                    {r.pm25} µg/m³
                  </span>
                )}
              </button>
            </li>
          ))}
          {!list.length && <li className="t-2" style={{ padding: 12 }}>Nalagam postaje…</li>}
        </ul>
        <button className="btn-soft" onClick={onClose}>
          Zapri
        </button>
      </div>
    </div>
  )
}

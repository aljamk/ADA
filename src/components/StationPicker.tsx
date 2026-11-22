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
  // Stations first, then sensors that are sending, then the silent ones (listed, not selectable)
  const live = readings.filter((r) => r.pm25 != null)
  const list = [...live.filter((r) => !isCitizen(r)), ...live.filter(isCitizen), ...readings.filter((r) => r.pm25 == null)]

  const useLocation = () => {
    setLocError(null)
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const at = { lat: p.coords.latitude, lon: p.coords.longitude }
        onPick(nearest(live, at.lat, at.lon).code, at)
      },
      () => setLocError('Lokacija ni na voljo. Izberi postajo ročno.'),
      { maximumAge: 600000, timeout: 10000 },
    )
  }

  return (
    <div className="picker" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="t-sub">Izberi postajo</p>
        <p className="t-small">Uradne postaje ARSO in občanski senzorji v Ljubljanski kotlini</p>
        <button className="link" style={{ textAlign: 'left' }} onClick={useLocation}>
          Uporabi mojo lokacijo (enkrat, brez sledenja)
        </button>
        <ul>
          {locError && <li className="error">{locError}</li>}
          {list.map((r) => (
            <li key={r.code}>
              <button className={r.code === value ? 'on' : ''} disabled={r.pm25 == null} style={r.pm25 == null ? { opacity: 0.6 } : undefined} onClick={() => onPick(r.code)}>
                <span style={{ display: 'grid', gap: 2 }}>
                  <span className="name">{shortName(r.name)}</span>
                  <span className="t-small" style={{ fontSize: 11 }}>
                    {isCitizen(r) ? 'občanski senzor' : 'uradna postaja ARSO'}
                  </span>
                </span>
                {r.pm25 != null ? (
                  <span className="t-2">
                    <span className="dot" style={{ background: levelOfPm(r.pm25).color }} />
                    {r.pm25} µg/m³
                  </span>
                ) : (
                  <span className="t-small">trenutno ne oddaja</span>
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

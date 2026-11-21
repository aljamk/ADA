import { useState } from 'react'
import { levelOfPm } from '../aqi'
import { nearest, searchText, type Reading } from '../arso'

interface Props {
  readings: Reading[]
  value: string
  onPick: (code: string, at?: { lat: number; lon: number }) => void
  onClose: () => void
}

/** Bottom sheet: search stations by city/name, or use location once (no background tracking). */
export default function StationPicker({ readings, value, onPick, onClose }: Props) {
  const [q, setQ] = useState('')
  const [locError, setLocError] = useState<string | null>(null)
  const list = readings.filter((r) => searchText(r).includes(q.trim().toLowerCase()))

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
        <p className="t-small">Postaje ARSO v Ljubljanski kotlini</p>
        <input autoFocus placeholder="Vpiši kraj ali postajo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="link" style={{ textAlign: 'left' }} onClick={useLocation}>
          Uporabi mojo lokacijo (enkrat, brez sledenja)
        </button>
        <ul>
          {locError && <li className="error">{locError}</li>}
          {list.map((r) => (
            <li key={r.code}>
              <button className={r.code === value ? 'on' : ''} onClick={() => onPick(r.code)}>
                <span>{r.name}</span>
                {r.pm25 != null && (
                  <span className="t-2">
                    <span className="dot" style={{ background: levelOfPm(r.pm25).color }} />
                    {r.pm25} µg/m³
                  </span>
                )}
              </button>
            </li>
          ))}
          {!list.length && <li className="t-2">Ni zadetkov.</li>}
        </ul>
        <button className="btn-soft" onClick={onClose}>
          Zapri
        </button>
      </div>
    </div>
  )
}

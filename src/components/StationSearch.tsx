import { useState } from 'react'
import { levelOf, nearest, searchText, type Reading } from '../arso'

interface Props {
  readings: Reading[]
  value: string
  onChange: (code: string) => void
}

/** Current station + search by city/station name, or one-time location (no background tracking). */
export default function StationSearch({ readings, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [locError, setLocError] = useState<string | null>(null)
  const current = readings.find((r) => r.code === value)

  const pick = (code: string) => {
    onChange(code)
    setOpen(false)
    setQ('')
  }

  const useLocation = () => {
    setLocError(null)
    navigator.geolocation?.getCurrentPosition(
      (p) => pick(nearest(readings, p.coords.latitude, p.coords.longitude).code),
      () => setLocError('Lokacija ni na voljo. Izberi postajo ročno.'),
      { maximumAge: 600000, timeout: 10000 },
    )
  }

  if (!open)
    return (
      <button className="station-btn" onClick={() => setOpen(true)}>
        📍 {current?.name ?? 'Nalagam postaje…'} <span className="muted">· spremeni</span>
      </button>
    )

  const list = readings.filter((r) => searchText(r).includes(q.trim().toLowerCase()))
  return (
    <section className="card search">
      <input autoFocus placeholder="Vpiši kraj ali postajo…" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="link" onClick={useLocation}>
        🎯 Uporabi mojo lokacijo (enkrat, brez sledenja)
      </button>
      {locError && <p className="error">{locError}</p>}
      <ul className="station-list">
        {list.map((r) => (
          <li key={r.code}>
            <button className={r.code === value ? 'active' : ''} onClick={() => pick(r.code)}>
              <span>{r.name}</span>
              {r.pm25 != null && (
                <span className="muted">
                  <span className="dot small" style={{ background: levelOf(r.pm25).color }} /> {r.pm25}
                </span>
              )}
            </button>
          </li>
        ))}
        {!list.length && <li className="muted">Ni zadetkov.</li>}
      </ul>
      <button className="link" onClick={() => setOpen(false)}>
        Zapri
      </button>
    </section>
  )
}

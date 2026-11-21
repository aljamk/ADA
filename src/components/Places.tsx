import type { Reading } from '../arso'

interface Props {
  readings: Reading[]
  home: string
  work: string
  onHome: (code: string) => void
  onWork: (code: string) => void
}

/** Home and work station for the "Moj dan" ring. Stored only on this device. */
export default function Places({ readings, home, work, onHome, onWork }: Props) {
  const options = readings.filter((r) => r.pm25 != null)
  const select = (value: string, onChange: (c: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((r) => (
        <option key={r.code} value={r.code}>
          {r.name}
        </option>
      ))}
    </select>
  )
  return (
    <section className="card places">
      <h2>Moja mesta</h2>
      <label>🏠 Dom {select(home, onHome)}</label>
      <label>💼 Služba / šola {select(work, onWork)}</label>
    </section>
  )
}

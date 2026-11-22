import { GolobRece } from '../components/Golob'

export interface AlertSettings {
  airing: boolean // "Obvesti me, ko je priporočljivo prezračiti"
  airingFrom: number
  airingTo: number
  eveningBefore: boolean // "Opozori me večer pred slabim dnem"
  eveningAt: number
  quietFrom: number
  quietTo: number
}

export const DEFAULT_ALERTS: AlertSettings = {
  airing: false, airingFrom: 7, airingTo: 21, eveningBefore: false, eveningAt: 19, quietFrom: 22, quietTo: 7,
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hhmm = (h: number) => `${h}:00`

function HourSelect({ value, onChange, label }: { value: number; onChange: (h: number) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {HOURS.map((h) => <option key={h} value={h}>{hhmm(h)}</option>)}
    </select>
  )
}

/** 09 · Opozorila */
export default function Opozorila({ settings, onChange }: { settings: AlertSettings; onChange: (s: AlertSettings) => void; stationName?: string }) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch })

  // Turning a switch on asks for notification permission first
  const toggle = async (key: 'airing' | 'eveningBefore') => {
    if (settings[key]) return set({ [key]: false })
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return
    }
    set({ [key]: true })
  }

  const Switch = ({ k }: { k: 'airing' | 'eveningBefore' }) => (
    <div style={{ display: 'grid', justifyItems: 'end', gap: 21 }}>
      <button className={settings[k] ? 'toggle on' : 'toggle'} onClick={() => toggle(k)} aria-pressed={settings[k]} aria-label="Stikalo obvestila" />
      <span className="t-small" style={{ fontWeight: 500 }}>{settings[k] ? 'Vklopljeno' : 'Izklopljeno'}</span>
    </div>
  )

  return (
    <div className="screen">
      <div>
        <p className="t-label">Po tvojem ritmu</p>
        <p className="t-title">Opozorila</p>
      </div>
      <p className="t-body t-2">Brez sledenja lokaciji v ozadju.</p>
      <GolobRece
        text={
          settings.airing && settings.eveningBefore
            ? 'Oglasim se samo dvakrat: ko je vredno odpreti okno in večer pred slabim dnem. Drugače molčim.'
            : settings.airing
              ? 'Povem ti, kdaj odpreti okno. Ne prej, ne pozneje. Golobi imamo nos za to.'
              : settings.eveningBefore
                ? 'Večer pred slabim dnem ti pošljem opozorilo. Brez panike, samo načrtuj sprehod.'
                : 'Vse izklopljeno? Prav. Golobi znamo biti tiho. Skoraj.'
        }
      />

      <section className="setting">
        <b className="t-body" style={{ fontWeight: 700 }}>Obvesti me, ko je<br />priporočljivo prezračiti</b>
        <Switch k="airing" />
        <div className="div" />
        <span className="t-2" style={{ fontSize: 16 }}>Čas obveščanja</span>
        <span>
          <HourSelect value={settings.airingFrom} onChange={(h) => set({ airingFrom: h })} label="Od" />–
          <HourSelect value={settings.airingTo} onChange={(h) => set({ airingTo: h })} label="Do" />
        </span>
      </section>

      <section className="setting">
        <b className="t-body" style={{ fontWeight: 700 }}>Opozori me večer<br />pred slabim dnem</b>
        <Switch k="eveningBefore" />
        <div className="div" />
        <span className="t-2" style={{ fontSize: 16 }}>Večer prej</span>
        <HourSelect value={settings.eveningAt} onChange={(h) => set({ eveningAt: h })} label="Ura" />
      </section>

      <p className="t-h3" style={{ marginTop: 12 }}>Mirne ure</p>
      <section className="quiet">
        Brez obvestil
        <span>
          <HourSelect value={settings.quietFrom} onChange={(h) => set({ quietFrom: h })} label="Od" />–
          <HourSelect value={settings.quietTo} onChange={(h) => set({ quietTo: h })} label="Do" />
        </span>
      </section>
      <p className="t-body t-2">
        Dovoljenje lahko kadarkoli
        <br />
        spremeniš v nastavitvah.
      </p>
    </div>
  )
}

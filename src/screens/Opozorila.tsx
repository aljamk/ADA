import { hru } from '../zvok'
import { GolobRece } from '../components/Golob'

export interface AlertSettings {
  airing: boolean // "Obvesti me, ko je priporočljivo prezračiti"
  airingFrom: number
  airingTo: number
  eveningBefore: boolean // "Opozori me večer pred slabim dnem"
  eveningAt: number
  quietFrom: number
  quietTo: number
  heating: boolean // "Obvesti me, ko se začne kurilna sezona" (mid-October)
  tourist: boolean // "Obvesti me, ko se začne turistična sezona" (start of June)
}

export const DEFAULT_ALERTS: AlertSettings = {
  airing: false, airingFrom: 7, airingTo: 21, eveningBefore: false, eveningAt: 19, quietFrom: 22, quietTo: 7,
  heating: false, tourist: false,
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

/** What Golob says: lists the alerts that are on, or admits to silence */
function golobText(s: AlertSettings) {
  const on = [
    s.airing && 'ko je vredno odpreti okno',
    s.eveningBefore && 'večer pred slabim dnem',
    s.heating && 'ob začetku kurilne sezone',
    s.tourist && 'ob začetku turistične sezone',
  ].filter((x): x is string => !!x)
  if (!on.length) return 'Vse izklopljeno? Prav. Golobi znamo biti tiho. Skoraj.'
  if (on.length === 1) return `Oglasim se samo ${on[0]}. Drugače molčim.`
  const list = `${on.slice(0, -1).join(', ')} in ${on[on.length - 1]}`
  return `Oglasim se ${['dvakrat', 'trikrat', 'štirikrat'][on.length - 2]}: ${list}. Drugače molčim.`
}

/** 09 · Opozorila */
export default function Opozorila({ settings, onChange }: { settings: AlertSettings; onChange: (s: AlertSettings) => void; stationName?: string }) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch })

  // Turning a switch on asks for notification permission first
  type Key = 'airing' | 'eveningBefore' | 'heating' | 'tourist'
  const toggle = async (key: Key) => {
    if (settings[key]) return set({ [key]: false })
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return
    }
    set({ [key]: true })
    hru() // so the user hears what an alert will sound like
  }

  const Switch = ({ k }: { k: Key }) => (
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
      <GolobRece text={golobText(settings)} />

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

      <section className="setting">
        <b className="t-body" style={{ fontWeight: 700 }}>Obvesti me, ko se<br />začne kurilna sezona</b>
        <Switch k="heating" />
        <div className="div" />
        <span className="t-2" style={{ fontSize: 15, gridColumn: '1 / -1' }}>Sredi oktobra. Kurišča pozimi dodajo največ delcev, zvečer tudi dvakrat več.</span>
      </section>

      <section className="setting">
        <b className="t-body" style={{ fontWeight: 700 }}>Obvesti me, ko se<br />začne turistična sezona</b>
        <Switch k="tourist" />
        <div className="div" />
        <span className="t-2" style={{ fontSize: 15, gridColumn: '1 / -1' }}>Začetek junija. Več prometa in dogodkov v središču mesta.</span>
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

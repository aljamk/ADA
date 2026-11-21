import type { ReactNode } from 'react'
import { PROFILES, type ProfileKey } from '../profile'

interface Props {
  profile: ProfileKey
  onProfile: (p: ProfileKey) => void
  notify: boolean
  onNotify: (on: boolean) => void
  children?: ReactNode // extra settings sections added by other features
}

/** "Jaz" tab: one-tap profile and notifications. No personal data, nothing leaves the device. */
export default function Me({ profile, onProfile, notify, onNotify, children }: Props) {
  const toggleNotify = async () => {
    if (notify) return onNotify(false)
    if (typeof Notification === 'undefined') return alert('Ta brskalnik ne podpira obvestil.')
    const perm = await Notification.requestPermission()
    onNotify(perm === 'granted')
  }

  return (
    <>
      <section className="card">
        <h2>Kdo sem?</h2>
        <p className="muted">Za občutljive skupine opozorimo že pri zmernem onesnaženju.</p>
        <div className="chips">
          {PROFILES.map((p) => (
            <button key={p.key} className={p.key === profile ? 'chip active' : 'chip'} onClick={() => onProfile(p.key)}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Obvestila</h2>
        <p className="muted">
          Opozorilo, ko bo zrak v naslednjih urah slab za tvoj profil. Prototip: deluje, ko je aplikacija odprta.
        </p>
        <button className="chip active" onClick={toggleNotify}>
          {notify ? '🔔 Vklopljena · izklopi' : '🔕 Vklopi obvestila'}
        </button>
      </section>

      {children}
    </>
  )
}

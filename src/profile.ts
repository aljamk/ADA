import { levelOf } from './arso'

// One-tap profile, no personal data. Sensitive groups get a lower alert threshold.
// Thresholds follow the EEA index: "Zmeren" (≥15) for sensitive groups, "Slab" (≥50) for everyone.
export const PROFILES = [
  { key: 'splosno', label: 'Splošno', emoji: '🙂', threshold: 50 },
  { key: 'nosecnica', label: 'Nosečnica', emoji: '🤰', threshold: 15 },
  { key: 'astma', label: 'Astma / pljuča', emoji: '🫁', threshold: 15 },
  { key: 'starejsi', label: '65+', emoji: '👵', threshold: 15 },
  { key: 'otroci', label: 'Otroci', emoji: '🧒', threshold: 15 },
] as const

export type ProfileKey = (typeof PROFILES)[number]['key']
export const profileOf = (k: ProfileKey) => PROFILES.find((p) => p.key === k) ?? PROFILES[0]

export function adviceFor(v: number, profile: ProfileKey) {
  const sensitive = profileOf(profile).threshold < 50
  const level = levelOf(v).label
  if (v < 15) return 'Zrak je čist. Odlično za sprehod in zračenje.'
  if (v < 50)
    return sensitive
      ? `${level}: daljši napor na prostem raje prestavi, zračí na kratko.`
      : `${level}: za večino brez omejitev.`
  if (v < 90)
    return sensitive ? `${level}: ostani raje v zaprtem, ne zrači.` : `${level}: zmanjšaj daljši napor zunaj.`
  return sensitive ? `${level}: ostani v zaprtem.` : `${level}: omeji čas zunaj, ne zrači.`
}

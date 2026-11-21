export const TABS = [
  { key: 'zdaj', label: 'Zdaj', icon: '/figma/nav-zdaj.svg' },
  { key: 'zemljevid', label: 'Zemljevid', icon: '/figma/nav-zemljevid.svg' },
  { key: 'igra', label: 'Igra', icon: '/figma/nav-igra.svg' },
  { key: 'liga', label: 'Liga', icon: '/figma/nav-liga.svg' },
  { key: 'opozorila', label: 'Opozorila', icon: '/figma/nav-opozorila.svg' },
] as const
export type TabKey = (typeof TABS)[number]['key']

/** Bottom navigation ("Navigacija" in Figma). Icons are the Figma SVGs used as masks, so they follow the theme. */
export default function TabBar({ tab, onTab }: { tab: TabKey; onTab: (t: TabKey) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.key} className={t.key === tab ? 'tab active' : 'tab'} onClick={() => onTab(t.key)}>
          <span className="icon" style={{ ['--src' as string]: `url(${t.icon})` }} />
          {t.label}
        </button>
      ))}
    </nav>
  )
}

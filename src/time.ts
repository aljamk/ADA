// All times are local Slovenian time strings "YYYY-MM-DD HH:00", the same format the ARSO feed uses.
const pad = (n: number) => String(n).padStart(2, '0')

export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hourStr = (d: Date) => `${dateStr(d)} ${pad(d.getHours())}:00`
export const tomorrow8 = () => `${dateStr(new Date(Date.now() + 86400000))} 08:00`
export const hh = (t: string) => t.slice(11, 13)

/** "2026-11-22 08:00" -> "22. 11." */
export const shortDate = (t: string) => `${Number(t.slice(8, 10))}. ${Number(t.slice(5, 7))}.`

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)
}

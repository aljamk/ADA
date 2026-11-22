// "Zakaj?" on Zdaj: a short explanation that follows the data the app already has (the current value,
// the shape of the next 24 hours of the calibrated model, the season and the hour). No new sources.
import { usAqi } from './aqi'
import type { ForecastHour } from './forecast'

const hourOf = (h: ForecastHour) => Number(h.time.slice(11, 13))
const winterMonth = (d = new Date()) => [11, 12, 1, 2, 3].includes(d.getMonth() + 1)

/**
 * One or two plain sentences. `pm` is the current PM2.5, `hours` the next 24 hours (may be empty).
 * The rules are ordered: what matters most for the next hours comes first.
 */
export function whyText(pm: number | null, hours: ForecastHour[], now = new Date()): string {
  const winter = winterMonth(now)
  const aqi = pm != null ? usAqi(pm) : null
  if (!hours.length || pm == null) {
    return winter
      ? 'Pozimi inverzija zadržuje delce v kotlini. Zvečer jih dodata ogrevanje in promet.'
      : 'Izven kurilne sezone se zrak bolje meša in delci se hitreje razredčijo.'
  }
  const peak = hours.reduce((b, h, i) => (h.value > hours[b].value ? i : b), 0)
  const low = hours.reduce((b, h, i) => (h.value < hours[b].value ? i : b), 0)
  const peakH = hourOf(hours[peak])
  const lowH = hourOf(hours[low])
  const peakV = hours[peak].value
  const lowV = hours[low].value
  const evening = peakH >= 17 || peakH <= 1
  const afternoon = lowH >= 11 && lowH <= 17
  const flat = peakV - lowV <= Math.max(4, pm * 0.25)

  // Bad right now: say why it is not thinning and when the model expects relief
  if (aqi != null && aqi > 100) {
    const relief = hours.find((h) => usAqi(h.value) <= 100)
    const when = relief ? ` Model pričakuje izboljšanje okoli ${hourOf(relief)}h.` : ' Po modelu se v naslednjih 24 urah ne bo bistveno zboljšalo.'
    return winter
      ? `Zdaj je delcev veliko: mrzel zrak leži na dnu kotline in brez vetra se delci iz kurišč in prometa ne razredčijo.${when}`
      : `Zdaj je delcev veliko: zrak v kotlini miruje in delci iz prometa se kopičijo.${when}`
  }
  // Clean and staying clean
  if (flat && aqi != null && aqi <= 50) {
    return winter
      ? 'Zrak je čist: veter ali toplejši zrak sta prezračila kotlino. Po modelu ostane tak do jutri.'
      : 'Zrak je čist in se po modelu do jutri ne bo bistveno spremenil.'
  }
  // The usual winter shape: an evening rise
  if (evening && peakV > pm * 1.2) {
    return winter
      ? `Model napoveduje vrh okoli ${peakH}h (${peakV} µg/m³): ob mrzlem večeru se delci iz kurišč in prometa nabirajo pod plastjo inverzije.`
      : `Model napoveduje vrh okoli ${peakH}h (${peakV} µg/m³): zvečer se zrak umiri in delci iz prometa se ne razredčijo.`
  }
  // A daytime drop: the ground warms and the air mixes
  if (afternoon && lowV < pm * 0.8) {
    return `Do ${lowH}h se spodnja plast zraka segreje in premeša, zato model napoveduje najmanj delcev popoldne (${lowV} µg/m³).`
  }
  if (flat) {
    return winter
      ? 'Vrednost se po modelu do jutri ne bo veliko spreminjala; kotlina je pozimi pogosto pod inverzijo, ki delce zadržuje.'
      : 'Vrednost se po modelu do jutri ne bo veliko spreminjala.'
  }
  return `Model napoveduje najmanj delcev okoli ${lowH}h (${lowV} µg/m³) in največ okoli ${peakH}h (${peakV} µg/m³).${winter ? ' Pozimi inverzija zadržuje delce v kotlini.' : ''}`
}

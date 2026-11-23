import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './native'
import { hru } from './zvok'
import { load, save } from './storage'

/**
 * Notifications in one place.
 *  - Android app: real system notifications through @capacitor/local-notifications, on the "robert" channel
 *    whose sound is Robert's coo (res/raw/golob_hru.wav). They are scheduled ahead, so they arrive with the app closed.
 *  - Web: the browser's Notification API while the page is open, with the coo played by the page.
 */

const TITLE = 'Kaj dihaš?'
const CHANNEL = 'robert'

/** Fixed ids, so every refresh replaces the earlier plan instead of piling up */
export const IDS = { airing: 101, evening: 102, heating: 103, tourist: 104 } as const
export type NotifKey = keyof typeof IDS

/** What is planned per key in this session, so re-renders with the same plan do nothing */
const planned: Partial<Record<NotifKey, string>> = {}

let channelReady: Promise<void> | null = null
function ensureChannel() {
  if (!isNative) return Promise.resolve()
  channelReady ??= LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Robert',
    description: 'Opozorila o zraku z Robertovim gruljenjem',
    importance: 4, // high: sound and heads-up
    sound: 'golob_hru.wav',
    vibration: true,
    visibility: 1,
  }).catch(() => {})
  return channelReady
}

/** Ask for permission (Android 13+ dialog, or the browser prompt). True when notifications may be shown. */
export async function askPermission(): Promise<boolean> {
  if (isNative) {
    await ensureChannel()
    const p = await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' }))
    return p.display === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  return (await Notification.requestPermission()) === 'granted'
}

async function nativeGranted() {
  const p = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }))
  return p.display === 'granted'
}

/** Show a notification now (web) — on Android this goes out a few seconds from now through the system. */
export async function showNow(key: NotifKey, body: string) {
  if (isNative) return planAt(key, new Date(Date.now() + 3000), body)
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(TITLE, { body, icon: '/icon-192.png' })
  hru()
}

/**
 * Android only: plan a notification for a moment in the future, replacing any earlier plan with the same key.
 * At most one per key per day: once a planned time has passed (so it was shown), that day is done.
 */
export async function planAt(key: NotifKey, at: Date, body: string) {
  if (!isNative || at.getTime() <= Date.now()) return
  const sig = `${at.getTime()}|${body}`
  if (planned[key] === sig) return
  if (!(await nativeGranted())) return // not marked as planned, so it is tried again once permission is given
  planned[key] = sig
  const day = at.toDateString()
  const prev = load<{ day: string; at: number } | null>('plan_' + key, null)
  if (prev && prev.day === day && prev.at < Date.now()) return // already shown today
  await ensureChannel()
  await LocalNotifications.cancel({ notifications: [{ id: IDS[key] }] }).catch(() => {})
  await LocalNotifications.schedule({
    notifications: [{ id: IDS[key], title: TITLE, body, channelId: CHANNEL, smallIcon: 'ic_stat_robert', iconColor: '#2F5544', sound: 'golob_hru.wav', schedule: { at, allowWhileIdle: true } }],
  }).catch(() => {})
  save('plan_' + key, { day, at: at.getTime() })
}

/** Android only: drop a planned notification (its switch was turned off, or the reason went away). */
export async function cancelPlan(key: NotifKey) {
  if (!isNative) return
  if (planned[key] === 'none') return
  planned[key] = 'none'
  const prev = load<{ day: string; at: number } | null>('plan_' + key, null)
  if (prev && prev.at < Date.now()) return // already shown, keep the "done today" mark
  await LocalNotifications.cancel({ notifications: [{ id: IDS[key] }] }).catch(() => {})
  save('plan_' + key, null)
}

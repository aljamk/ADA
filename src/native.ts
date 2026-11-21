import { App as CapApp } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import type { BucketKey } from './game'

// Bridge between the web app and the native Android widget.
// Values go to SharedPreferences "CapacitorStorage", which AirWidgetProvider.java reads.
// On the web (npm run dev) all of this is a no-op.

export const isNative = Capacitor.isNativePlatform()
const WidgetBridge = registerPlugin<{ reload(): Promise<void> }>('WidgetBridge')

export async function syncWidget(data: Record<string, string>) {
  if (!isNative) return
  for (const [key, value] of Object.entries(data)) await Preferences.set({ key, value })
  await WidgetBridge.reload().catch(() => {})
}

export interface WidgetBet {
  station: string
  stationName?: string
  target: string
  bucket: BucketKey
}

/** A bet placed with the widget buttons while the app was closed (taken once). */
export async function takeWidgetBet(): Promise<WidgetBet | null> {
  if (!isNative) return null
  const { value } = await Preferences.get({ key: 'widgetBet' })
  if (!value) return null
  await Preferences.remove({ key: 'widgetBet' })
  try {
    return JSON.parse(value) as WidgetBet
  } catch {
    return null
  }
}

/** Run fn on start and every time the app comes back to the foreground. */
export function onResume(fn: () => void) {
  fn()
  if (!isNative) return () => {}
  const handle = CapApp.addListener('appStateChange', ({ isActive }) => isActive && fn())
  return () => void handle.then((h) => h.remove())
}

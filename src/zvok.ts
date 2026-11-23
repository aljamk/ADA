/**
 * Robert's coo, "hru hru hruuu" (public/golob-hru.wav, made by scripts/build_hru.py),
 * played together with every notification and once as a preview when an alert is switched on.
 */
const SRC = '/golob-hru.wav'
let audio: HTMLAudioElement | null = null

/**
 * Play the coo. Browsers may block sound until the user has touched the page; then the coo
 * waits for the first tap within a minute instead of being lost.
 */
export function hru() {
  if (typeof Audio === 'undefined') return
  audio ??= new Audio(SRC)
  audio.currentTime = 0
  audio.play().catch(() => {
    const until = Date.now() + 60_000
    const once = () => {
      window.removeEventListener('pointerdown', once)
      if (Date.now() < until) audio?.play().catch(() => {})
    }
    window.addEventListener('pointerdown', once, { once: true })
  })
}

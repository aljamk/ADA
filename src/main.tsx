import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import App from './App'
import Predstavitev, { useWide } from './screens/Predstavitev'
import './theme.css'

/** On a wide screen the app is shown inside a phone frame with the widgets and Robert's moods beside it; the frame's own page (?embed=1) and phones get the plain app. */
function Shell() {
  const wide = useWide()
  const embed = new URLSearchParams(window.location.search).get('embed') === '1'
  return wide && !embed ? <Predstavitev /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)

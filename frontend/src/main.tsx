import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { unlockAudio } from './lib/audio'
import { unlockSounds } from './lib/sounds'
import { I18nProvider } from './i18n'
import { AppProvider } from './state'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/ui.css'
import './styles/learn.css'
import './styles/pages.css'
import './styles/games.css'
import './styles/mobile.css'

// iPhone/iPad: звук разрешён только после касания — разблокируем плеер и звуки при первом же касании.
const unlock = () => {
  unlockAudio()
  unlockSounds()
  for (const ev of ['touchend', 'pointerdown', 'keydown']) document.removeEventListener(ev, unlock, true)
}
for (const ev of ['touchend', 'pointerdown', 'keydown']) document.addEventListener(ev, unlock, true)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// офлайн-кеш для статической версии (GitHub Pages, «На экран Домой»)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}

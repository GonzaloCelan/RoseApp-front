import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

window.__roseInstallPrompt = null

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__roseInstallPrompt = event
  window.dispatchEvent(new CustomEvent('rose:pwa-installable', { detail: event }))
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.update()
        document.documentElement.dataset.pwa = 'ready'
      })
      .catch(() => {
        document.documentElement.dataset.pwa = 'unavailable'
        // La aplicación web sigue funcionando aunque el navegador no habilite la PWA.
      })
  })
}

window.addEventListener('appinstalled', () => {
  window.__roseInstallPrompt = null
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './interactions.css'
import AppRouter from './AppRouter.jsx'
import AppErrorBoundary from './components/feedback/AppErrorBoundary.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {
      // The app remains usable if service-worker registration is unavailable.
    })
  }, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><AppRouter /></AppErrorBoundary>
  </StrictMode>,
)

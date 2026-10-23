import { useEffect, useRef, useState } from 'react'
import './install-app-button.css'

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function installInstructions() {
  const userAgent = window.navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'In Safari, tap Share, choose “Add to Home Screen”, then tap Add.'
  }
  if (/Android/i.test(userAgent)) {
    return 'Open your browser menu and choose “Install app” or “Add to Home screen”.'
  }
  return 'Use your browser’s install icon or menu and choose “Install Amanzi”.'
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => isInstalled())
  const [showHelp, setShowHelp] = useState(false)
  const [renderedHelp, setRenderedHelp] = useState(false)
  const closeTimer = useRef(null)

  function toggleHelp() {
    if (showHelp) closeHelp()
    else {
      window.clearTimeout(closeTimer.current)
      setRenderedHelp(true)
      setShowHelp(true)
    }
  }

  function closeHelp() {
    setShowHelp(false)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setRenderedHelp(false), 150)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    const onInstallAvailable = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      closeHelp()
    }

    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function handleInstall() {
    if (!installPrompt) {
      toggleHelp()
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice?.outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  return <div className="install-app-control">
    <button type="button" className="install-app-button" onClick={handleInstall} aria-expanded={showHelp} aria-controls="install-app-help">
      <span aria-hidden="true">↓</span><span className="install-app-label">Install app</span>
    </button>
    {renderedHelp && <div className="install-app-help" id="install-app-help" role="dialog" aria-label="Install Amanzi" data-open={showHelp} aria-hidden={!showHelp} inert={!showHelp}>
      <button type="button" className="install-app-help-close" onClick={closeHelp} aria-label="Close install instructions">×</button>
      <strong>Add Amanzi to your home screen</strong>
      <p>{installInstructions()}</p>
    </div>}
  </div>
}

import { useEffect, useRef, useState } from 'react'
import './loading-screen.css'

export default function LoadingScreen({ active, label = 'Getting Amanzi ready…', delay = 220, minDuration = 420 }) {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (active) {
      if (visible) return undefined
      const showTimer = window.setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, delay)
      return () => window.clearTimeout(showTimer)
    }

    if (!visible) return undefined
    const remaining = Math.max(0, minDuration - (Date.now() - shownAt.current))
    const hideTimer = window.setTimeout(() => setVisible(false), remaining)
    return () => window.clearTimeout(hideTimer)
  }, [active, delay, minDuration, visible])

  if (!visible) return null

  return <div className="loading-screen" role="status" aria-live="polite" aria-label={label}>
    <video className="loading-screen-video" autoPlay muted playsInline loop preload="auto" aria-hidden="true">
      <source src="/media/amanzi-loader.mp4" type="video/mp4" />
    </video>
    <span className="sr-only">{label}</span>
  </div>
}

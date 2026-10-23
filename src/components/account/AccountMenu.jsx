import { useEffect, useRef, useState } from 'react'
import './account-menu.css'

const noop = () => {}

export default function AccountMenu({ user, supabase, onRequireAccount, onLoadingChange = noop }) {
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const closeTimer = useRef(null)

  function closeMenu() {
    setOpen(false)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setRendered(false), 150)
  }

  function toggleMenu() {
    if (open) closeMenu()
    else {
      window.clearTimeout(closeTimer.current)
      setRendered(true)
      setOpen(true)
    }
    setError('')
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) closeMenu()
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeMenu()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function signOut() {
    if (busy) return
    setBusy(true)
    setError('')
    onLoadingChange('account-signout', true, 'Signing you out…')
    try {
      const registration = await navigator.serviceWorker?.ready
      const pushSubscription = await registration?.pushManager?.getSubscription()
      if (pushSubscription) {
        const { error: pushError } = await supabase.functions.invoke('manage-push-subscriptions', {
          body: { action: 'unsubscribe', endpoint: pushSubscription.endpoint },
        })
        if (pushError) throw pushError
        await pushSubscription.unsubscribe()
      }
      const { error: signoutError } = await supabase.auth.signOut()
      if (signoutError) throw signoutError
      closeMenu()
      onRequireAccount()
    } catch {
      setError('Could not sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
      onLoadingChange('account-signout', false)
    }
  }

  return <div className="account-menu" ref={menuRef}>
    <button ref={triggerRef} className="avatar" type="button" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={open} aria-controls="account-menu" onClick={toggleMenu}>
      {user?.email?.charAt(0).toUpperCase() || 'A'}
    </button>
    {rendered && <div className="account-menu-dropdown" id="account-menu" role="menu" data-open={open} aria-hidden={!open} inert={!open}>
      {error && <p className="account-menu-error" role="alert">{error}</p>}
      <button className="account-menu-signout" type="button" role="menuitem" onClick={signOut} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>}
  </div>
}

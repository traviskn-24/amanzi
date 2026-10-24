import { useEffect, useRef, useState } from 'react'
import './account-menu.css'

const noop = () => {}

function useAccountSignOut({ supabase, onRequireAccount, onLoadingChange = noop, onSuccess = noop }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      onSuccess()
      onRequireAccount()
    } catch {
      setError('Could not sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
      onLoadingChange('account-signout', false)
    }
  }

  return { busy, error, clearError: () => setError(''), signOut }
}

export function MobileSignOutButton({ user, supabase, onRequireAccount, onLoadingChange = noop, onClose }) {
  const { busy, error, signOut } = useAccountSignOut({
    supabase,
    onRequireAccount,
    onLoadingChange,
    onSuccess: onClose,
  })

  if (!user || user.is_anonymous) return null
  return <div className="mobile-navigation-account">
    {error && <p className="account-menu-error" role="alert">{error}</p>}
    <button className="account-menu-signout mobile-navigation-signout" type="button" onClick={signOut} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  </div>
}

export default function AccountMenu({ user, supabase, onRequireAccount, onLoadingChange = noop }) {
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
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
    clearError()
  }

  const { busy, error, clearError, signOut } = useAccountSignOut({
    supabase,
    onRequireAccount,
    onLoadingChange,
    onSuccess: closeMenu,
  })

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

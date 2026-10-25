import { useCallback, useEffect, useState } from 'react'
import AccountSecurity from '../AccountSecurity'
import '../account-security.css'
import './create-account-page.css'
import { isJudgeDemoUser } from '../lib/judge-demo'

export default function CreateAccountPage({ supabase, onClose, onAuthChange, onLoadingChange }) {
  const [user, setUser] = useState(null)
  const [sessionWarning, setSessionWarning] = useState('')

  useEffect(() => {
    let active = true
    if (!supabase) return undefined
    onLoadingChange('create-account-session', true, 'Checking your account…')
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return
      if (error) { setSessionWarning('We could not check your current session. You can still try to sign in or create an account.'); return }
      const nextUser = data.session?.user || null
      if (!nextUser || nextUser.is_anonymous) return
      if (isJudgeDemoUser(nextUser)) {
        setUser(nextUser)
        return
      }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!active) return
      if (assuranceError) { setSessionWarning('We could not verify your current session. Sign in again if this page does not continue.'); return }
      if (assurance.currentLevel === 'aal2') {
        onAuthChange(nextUser, 'aal2')
        return
      }
      setUser(nextUser)
    }).catch(() => {
      if (active) setSessionWarning('Account services are temporarily unavailable. Please check your connection and try again.')
    }).finally(() => {
      if (active) onLoadingChange('create-account-session', false)
    })
    return () => { active = false; onLoadingChange('create-account-session', false) }
  }, [supabase, onAuthChange, onLoadingChange])

  const handleAuthChange = useCallback((nextUser, level) => {
    setUser(nextUser)
    onAuthChange(nextUser, level)
  }, [onAuthChange])

  if (!supabase) {
    return <main className="account-page-unavailable"><h1>Account setup is unavailable</h1><p>Amanzi could not connect to account services. Please try again shortly.</p><button className="account-secondary" onClick={onClose}>Return to Amanzi</button></main>
  }

  return <AccountSecurity supabase={supabase} user={user} onClose={onClose} onAuthChange={handleAuthChange} onLoadingChange={onLoadingChange} standalone initialMode="create" sessionWarning={sessionWarning} />
}

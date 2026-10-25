import { useEffect, useState } from 'react'
import './account-security.css'
import { authRedirectUrl } from './lib/auth-urls'
import { containsBlockedLanguage, PASSWORD_LANGUAGE_ERROR, USERNAME_LANGUAGE_ERROR } from './lib/content-moderation'
import { isJudgeDemoUser, getJudgeDemoUsername } from './lib/judge-demo'

const noop = () => {}

function PasswordVisibilityButton({ visible, onToggle, controls }) {
  return <button className="password-visibility" type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} aria-controls={controls} onClick={onToggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{visible ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.7 4.5 9.6 6.1a1.7 1.7 0 0 1 0 1.8 13.7 13.7 0 0 1-3.2 3.6"/><path d="M6.2 6.2a14.2 14.2 0 0 0-3.8 4.9 1.7 1.7 0 0 0 0 1.8C3.3 14.5 6.8 19 12 19c1.1 0 2.1-.2 3-.6"/></> : <><path d="M2.4 12s3.5-6.5 9.6-6.5 9.6 6.5 9.6 6.5-3.5 6.5-9.6 6.5S2.4 12 2.4 12Z"/><circle cx="12" cy="12" r="2.7"/></>}</svg>
  </button>
}

export default function AccountSecurity({ supabase, user, onClose, onAuthChange, onLoadingChange = noop, standalone = false, initialMode = 'sign-in', sessionWarning = '' }) {
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState(user && !user.is_anonymous ? 'checking' : 'account')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function addBackupFactor() {
    setBusy(true)
    onLoadingChange('account-security', true, 'Adding a backup authenticator…')
    setError('')
    try {
      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Amanzi backup authenticator' })
      if (enrollmentError) throw enrollmentError
      setFactorId(enrollment.id)
      setQrCode(enrollment.totp.qr_code)
      setSecret(enrollment.totp.secret)
      setCode('')
      setStep('enroll')
    } catch (cause) {
      setError(cause.message || 'Could not add a backup authenticator.')
    } finally {
      setBusy(false)
      onLoadingChange('account-security', false)
    }
  }

  useEffect(() => {
    if (!user || user.is_anonymous || !user.email_confirmed_at) return undefined
    let active = true
    async function initializeMfa() {
      onLoadingChange('account-security', true, 'Preparing secure sign-in…')
      try {
        if (isJudgeDemoUser(user)) {
          setStep('judge-demo')
          return
        }
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        if (!active) return
        setError('')
        setMessage('')
        setBusy(true)
        setStep('checking')
        if (assurance.currentLevel === 'aal2') {
          onAuthChange(user, 'aal2')
          setStep('profile')
          return
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
        if (factorsError) throw factorsError
        if (!active) return
        const verifiedFactor = factors.totp?.find((factor) => factor.status === 'verified')
        if (verifiedFactor) {
          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id })
          if (challengeError) throw challengeError
          if (!active) return
          setFactorId(verifiedFactor.id)
          setChallengeId(challenge.id)
          setStep('challenge')
        } else {
          const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Amanzi authenticator' })
          if (enrollmentError) throw enrollmentError
          if (!active) return
          setFactorId(enrollment.id)
          setQrCode(enrollment.totp.qr_code)
          setSecret(enrollment.totp.secret)
          setStep('enroll')
        }
      } catch (cause) {
        if (active) {
          setError(cause.message || 'Could not start two-step verification. Please try again.')
          setStep('account')
        }
      } finally {
        if (active) {
          setBusy(false)
          onLoadingChange('account-security', false)
        }
      }
    }
    initializeMfa()
    return () => { active = false; onLoadingChange('account-security', false) }
  }, [user, supabase, onAuthChange, onLoadingChange])

  async function submitAccount(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    onLoadingChange('account-security', true, mode === 'create' ? 'Creating your account…' : 'Signing you in…')
    setError('')
    setMessage('')
    try {
      if (mode === 'forgot-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl('/reset-password') })
        if (resetError) throw resetError
        setMessage(`If an Amanzi account exists for ${email.trim()}, we sent a password reset link. Check your inbox and spam folder.`)
      } else if (mode === 'create') {
        if (password !== confirmPassword) throw new Error('Your passwords do not match.')
        const normalizedUsername = username.trim().toLowerCase()
        if (containsBlockedLanguage(normalizedUsername)) throw new Error(USERNAME_LANGUAGE_ERROR)
        if (containsBlockedLanguage(password)) throw new Error(PASSWORD_LANGUAGE_ERROR)
        if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
          throw new Error('Choose a username with 3–20 lowercase letters, numbers, or underscores.')
        }
        const { data: existingUsername, error: usernameError } = await supabase.from('profiles')
          .select('user_id').eq('username', normalizedUsername).maybeSingle()
        if (usernameError) throw usernameError
        if (existingUsername) throw new Error('That username is already taken. Try another one.')
        const { error: signupError } = user?.is_anonymous
          ? await supabase.auth.updateUser({ email: email.trim(), password, data: { username: normalizedUsername } }, { emailRedirectTo: authRedirectUrl('/create-account') })
          : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirectUrl('/create-account'), data: { username: normalizedUsername } } })
        if (signupError?.code === '23505') throw new Error('That username is already taken. Try another one.')
        if (signupError) throw signupError
        setStep('confirmation')
        setMessage(`We sent a confirmation link to ${email.trim()}. Confirm your email, then return here to finish setting up two-step verification.`)
      } else {
        const { data, error: signinError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (signinError) throw signinError
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut()
          throw new Error('Please confirm your email address before signing in.')
        }
        if (isJudgeDemoUser(data.user)) {
          setStep('judge-demo')
          onAuthChange(data.user, 'judge-pending')
          return
        }
        onAuthChange(data.user, 'aal1')
      }
    } catch (cause) {
      setError(cause.message || 'Could not complete account setup. Please try again.')
    } finally {
      setBusy(false)
      onLoadingChange('account-security', false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    onLoadingChange('account-security', true, 'Verifying your security code…')
    setError('')
    try {
      let activeChallengeId = challengeId
      if (step === 'enroll') {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
        if (challengeError) throw challengeError
        activeChallengeId = challenge.id
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: activeChallengeId, code: code.trim() })
      if (verifyError) throw verifyError
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError) throw assuranceError
      if (assurance.currentLevel !== 'aal2') throw new Error('The code was accepted, but the secure session has not refreshed yet. Try again.')
      const { data: { user: authUser } } = await supabase.auth.getUser()
      onAuthChange(authUser, 'aal2')
      setStep('profile')
    } catch (cause) {
      setError(cause.message || 'That code did not work. Check your authenticator and try again.')
    } finally {
      setBusy(false)
      onLoadingChange('account-security', false)
    }
  }

  async function signOut() {
    setBusy(true)
    onLoadingChange('account-security', true, 'Signing you out…')
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
    } catch {
      setError('Could not remove this device from push alerts. Please try again before signing out.')
      setBusy(false)
      onLoadingChange('account-security', false)
      return
    }
    const { error: signoutError } = await supabase.auth.signOut()
    if (signoutError) setError('Could not sign out. Please try again.')
    else {
      onAuthChange(null, 'guest')
      onClose()
    }
    setBusy(false)
    onLoadingChange('account-security', false)
  }

  const visibleStep = user && !user.is_anonymous && !user.email_confirmed_at ? 'confirmation' : step
  const visibleMessage = visibleStep === 'confirmation' && !message ? `Confirm ${user?.email || 'your email address'} to continue with two-step verification.` : message
  return <div className={`account-backdrop${standalone ? ' account-page-backdrop' : ''}`} role="presentation" onMouseDown={(event) => { if (!standalone && event.target === event.currentTarget) onClose() }}>
    <section className="account-card" role={standalone ? undefined : 'dialog'} aria-modal={standalone ? undefined : 'true'} aria-labelledby="account-title">
      {!standalone && <button className="close-button account-close" onClick={onClose} aria-label="Close account window">×</button>}
      <img className="account-brand-logo" src="/brand/amanzi-logo.png" alt="Amanzi" />
      <span className="account-kicker">AMANZI ACCOUNT SECURITY</span>
      <h2 id="account-title">{visibleStep === 'judge-demo' ? 'Judge account recognized' : visibleStep === 'confirmation' ? 'Confirm your email' : visibleStep === 'profile' ? 'Your Amanzi account' : visibleStep === 'enroll' ? 'Set up two-step verification' : visibleStep === 'challenge' ? 'Verify it’s you' : visibleStep === 'checking' ? 'Checking your secure session…' : user && !user.is_anonymous ? 'Secure your account' : mode === 'create' ? 'Create your account' : mode === 'forgot-password' ? 'Reset your password' : 'Welcome back'}</h2>
      {sessionWarning && <p className="account-error" role="status">{sessionWarning}</p>}
      {visibleStep === 'profile' && <><p className="account-copy">Signed in as <strong>{user?.email}</strong></p><div className="account-security-status">✓ Two-step verification is active on this session.</div>{error && <p className="account-error" role="alert">{error}</p>}<button className="account-secondary" onClick={addBackupFactor} disabled={busy}>Add a backup authenticator</button><small className="account-hint">Supabase does not issue recovery codes. A second authenticator device helps prevent lockout.</small><button className="account-signout" onClick={signOut} disabled={busy}>Sign out</button></>}
      {visibleStep === 'account' && <>
        <p className="account-copy">{mode === 'forgot-password' ? 'Enter your account email and we’ll send you a secure password reset link.' : 'Your account keeps you signed in and protects your Amanzi activity.'}</p>
        {mode !== 'forgot-password' && <div className="account-tabs"><button className={mode === 'sign-in' ? 'active' : ''} onClick={() => { setMode('sign-in'); setError(''); setMessage(''); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false) }}>Sign in</button><button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setError(''); setMessage(''); setShowPassword(false); setShowConfirmPassword(false) }}>Create account</button></div>}
        <form key={mode} className="account-form account-form-transition" onSubmit={submitAccount}>
          {mode === 'create' && <><label>Username<input className="uiverse-input" type="text" required autoComplete="username" autoCapitalize="none" spellCheck="false" minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" title="Use 3–20 letters, numbers, or underscores." value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. waterwatcher" /></label><small className="account-hint">This is shown on your community updates and area chats.</small></>}
          <label>Email address<input className="uiverse-input" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          {mode !== 'forgot-password' && <div className="account-password-field"><label htmlFor="account-password">Password</label><div className="password-input-wrap"><input id="account-password" className="uiverse-input" type={showPassword ? 'text' : 'password'} required minLength={10} maxLength={72} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'create' ? 'At least 10 characters' : 'Your password'} /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} controls="account-password" /></div></div>}
          {mode === 'create' && <div className="account-password-field"><label htmlFor="account-confirm-password">Confirm password</label><div className="password-input-wrap"><input id="account-confirm-password" className="uiverse-input" type={showConfirmPassword ? 'text' : 'password'} required minLength={10} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /><PasswordVisibilityButton visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((visible) => !visible)} controls="account-confirm-password" /></div></div>}
          {mode === 'create' && <small className="account-hint">We’ll ask you to confirm your email, then set up an authenticator app.</small>}
          {error && <p className="account-error" role="alert">{error}</p>}
          {message && <p className="account-message" role="status">{message}</p>}
          <button className="post-button account-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'create' ? 'Create secure account' : mode === 'forgot-password' ? 'Send reset link' : 'Sign in'}</button>
        </form>
        {(mode === 'sign-in' || mode === 'create') && <button className="account-text-button" type="button" onClick={() => { setMode('forgot-password'); setError(''); setMessage(''); setPassword('') }}>Forgot password?</button>}
        {mode === 'forgot-password' && <button className="account-secondary" type="button" onClick={() => { setMode('sign-in'); setError(''); setMessage('') }}>Back to sign in</button>}
      </>}
      {visibleStep === 'confirmation' && <><p className="account-copy">{visibleMessage}</p>{error && <p className="account-error" role="alert">{error}</p>}<button className="account-secondary" onClick={() => { setStep('account'); setMode('sign-in'); setMessage(''); setError('') }}>Back to sign in</button></>}
      {visibleStep === 'checking' && <p className="account-copy">Preparing your sign-in verification…</p>}
      {visibleStep === 'judge-demo' && <><p className="account-copy"><strong>Judge account recognized.</strong> You can continue without setting up an authenticator to keep the review moving. This shared judge account is read-only, so it cannot post, confirm, chat, or change saved areas.</p><div className="account-security-status">Judge preview · signed in as {getJudgeDemoUsername(user)}</div><button className="post-button account-submit" onClick={() => onAuthChange(user, 'judge-demo')}>Continue to Amanzi</button></>}
      {visibleStep === 'enroll' && <>
        <p className="account-copy">Scan this QR code with an authenticator app such as Google Authenticator, Microsoft Authenticator, or 1Password. Enter the current six-digit code to confirm setup.</p>
        {qrCode && <img className="account-qr" src={qrCode} alt="QR code for Amanzi two-step verification" />}
        <details className="account-secret"><summary>Can’t scan the code?</summary><code>{secret}</code></details>
        <form className="account-form" onSubmit={verifyCode}><label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>{error && <p className="account-error" role="alert">{error}</p>}<button className="post-button account-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>
      </>}
      {visibleStep === 'challenge' && <><p className="account-copy">Enter the six-digit code from your authenticator app to continue. Your session stays signed in on this device after verification.</p><form className="account-form" onSubmit={verifyCode}><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>{error && <p className="account-error" role="alert">{error}</p>}<button className="post-button account-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form></>}
      {user && !user.is_anonymous && visibleStep !== 'profile' && <button className="account-signout" onClick={signOut} disabled={busy}>Sign out</button>}
    </section>
  </div>
}

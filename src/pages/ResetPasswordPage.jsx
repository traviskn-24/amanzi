import { useEffect, useState } from 'react'

export default function ResetPasswordPage({ supabase, onSignIn, onLoadingChange }) {
  const [ready, setReady] = useState(false)
  const [complete, setComplete] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && active) setReady(true)
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (active && !sessionError && data.session) setReady(true)
    }).catch(() => {})
    return () => { active = false; subscription.unsubscribe() }
  }, [supabase])

  async function submit(event) {
    event.preventDefault()
    if (busy || !supabase) return
    if (password !== confirmPassword) { setError('Your passwords do not match.'); return }
    setBusy(true)
    setError('')
    onLoadingChange('password-reset', true, 'Updating your password…')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      // Require a fresh sign-in so the normal two-step verification flow still applies.
      await supabase.auth.signOut()
      setComplete(true)
    } catch (cause) {
      setError(cause.message || 'We could not update your password. Request a new reset link and try again.')
    } finally {
      setBusy(false)
      onLoadingChange('password-reset', false)
    }
  }

  return <main className="reset-page">
    <section className="reset-card" aria-labelledby="reset-title">
      <img className="reset-logo" src="/brand/amanzi-logo.png" alt="Amanzi" />
      <span className="reset-kicker">AMANZI ACCOUNT SECURITY</span>
      <h1 id="reset-title">{complete ? 'Password updated' : 'Choose a new password'}</h1>
      {complete ? <><p>Your password has been changed. Sign in with your new password and complete two-step verification.</p><button className="post-button" onClick={onSignIn}>Back to sign in</button></> : !ready ? <><p>This reset link is invalid, expired, or already used. Request a new password reset link and open the newest email.</p><button className="post-button" onClick={onSignIn}>Request another link</button></> : <>
        <p>Choose a new password for your Amanzi account. Use at least 10 characters.</p>
        <form className="reset-form" onSubmit={submit}>
          <label>New password<div className="reset-password-wrap"><input type={showPassword ? 'text' : 'password'} minLength={10} maxLength={72} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          <label>Confirm new password<input type={showPassword ? 'text' : 'password'} minLength={10} maxLength={72} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="post-button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>
      </>}
    </section>
  </main>
}

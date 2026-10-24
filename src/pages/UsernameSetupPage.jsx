import { useEffect, useState } from 'react'
import './username-setup-page.css'

const noop = () => {}

export default function UsernameSetupPage({ supabase, onComplete, onRequireSignIn, onLoadingChange = noop }) {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      onLoadingChange('username-setup', true, 'Checking your account…')
      try {
        if (!supabase) throw new Error('Account services are unavailable. Please try again later.')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const currentUser = session?.user
        if (!currentUser || currentUser.is_anonymous) { onRequireSignIn(); return }

        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        if (assurance.currentLevel !== 'aal2') { onRequireSignIn(); return }

        const { data: profile, error: profileError } = await supabase.from('profiles')
          .select('username').eq('user_id', currentUser.id).maybeSingle()
        if (profileError) throw profileError
        if (!active) return
        if (profile?.username) { onComplete(); return }

        setUser(currentUser)
        setUsername(typeof currentUser.user_metadata?.username === 'string' ? currentUser.user_metadata.username : '')
      } catch (cause) {
        if (active) setError(cause.message || 'We could not load your account. Please try again.')
      } finally {
        if (active) setLoading(false)
        onLoadingChange('username-setup', false)
      }
    }
    void loadProfile()
    return () => { active = false; onLoadingChange('username-setup', false) }
  }, [supabase, onComplete, onRequireSignIn, onLoadingChange])

  async function saveUsername(event) {
    event.preventDefault()
    if (!user || saving) return
    const nextUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(nextUsername)) {
      setError('Use 3–20 characters: lowercase letters, numbers, or underscores.')
      return
    }

    setSaving(true)
    setError('')
    onLoadingChange('username-setup', true, 'Saving your username…')
    try {
      const { data: existing, error: lookupError } = await supabase.from('profiles')
        .select('user_id').eq('username', nextUsername).neq('user_id', user.id).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        setError('That username is already taken. Try another one.')
        return
      }

      const { data: updatedProfile, error: updateError } = await supabase.from('profiles')
        .update({ username: nextUsername, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).select('user_id').maybeSingle()
      if (updateError?.code === '23505') {
        setError('That username is already taken. Try another one.')
        return
      }
      if (updateError) throw updateError
      if (!updatedProfile) throw new Error('Your profile is still being prepared. Refresh this page and try again.')
      onComplete()
    } catch (cause) {
      setError(cause.message || 'We could not save that username. Please try again.')
    } finally {
      setSaving(false)
      onLoadingChange('username-setup', false)
    }
  }

  return <main className="username-setup-page">
    <section className="username-setup-card" aria-labelledby="username-setup-title">
      <img className="account-brand-logo" src="/brand/amanzi-logo.png" alt="Amanzi" />
      <span className="username-setup-kicker">MAKE IT YOURS</span>
      <h1 id="username-setup-title">Choose your username</h1>
      <p className="username-setup-intro">Your username appears on your water updates and area chats, so neighbours know who’s sharing. Keep your exact name, address, and other private details out of it.</p>

      {loading ? <p className="username-setup-status" role="status">Checking your secure account…</p> : <form className="username-setup-form" onSubmit={saveUsername}>
        <label htmlFor="amanzi-username">Username</label>
        <div className="username-input-wrap"><span aria-hidden="true">@</span><input id="amanzi-username" autoComplete="username" autoCapitalize="none" spellCheck="false" minLength={3} maxLength={20} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. waterwatcher" required /></div>
        <small>3–20 characters. Use lowercase letters, numbers, or underscores.</small>
        {error && <p className="username-setup-error" role="alert">{error}</p>}
        <button className="post-button username-setup-submit" disabled={saving || !user}>{saving ? 'Saving username…' : 'Continue to Amanzi'}</button>
      </form>}
    </section>
  </main>
}

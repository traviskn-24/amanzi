import { useEffect, useMemo, useState } from 'react'
import LocationSearch from '../components/community/LocationSearch'
import { locationKey, locationMatches, maxSavedAreas } from '../lib/locations'
import './area-onboarding-page.css'

export default function AreaOnboardingPage({ supabase, onComplete, onRequireSignIn, onLoadingChange }) {
  const [user, setUser] = useState(null)
  const [areas, setAreas] = useState([])
  const [defaultKey, setDefaultKey] = useState('')
  const [savedDefaultKey, setSavedDefaultKey] = useState('')
  const [areasAlreadySaved, setAreasAlreadySaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reachedLimit = areas.length >= maxSavedAreas
  const canContinue = areas.length > 0 && areas.some((area) => locationKey(area) === defaultKey)
  const searchLocation = useMemo(() => areas.at(-1) || { area: '', municipality: '', province: '' }, [areas])

  useEffect(() => {
    let active = true
    async function loadAccountAreas() {
      onLoadingChange('area-onboarding', true, 'Loading your saved communities…')
      if (!supabase) {
        setError('Account services are unavailable. Please try again later.')
        setLoading(false)
        onLoadingChange('area-onboarding', false)
        return
      }
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const currentUser = session?.user || null
        if (!currentUser || currentUser.is_anonymous) { onRequireSignIn(); return }
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        if (assurance.currentLevel !== 'aal2') { onRequireSignIn(); return }
        const { data, error: queryError } = await supabase.from('user_areas').select('slot, area, municipality, province, is_default').order('slot')
        if (queryError) throw queryError
        if (!active) return
        setUser(currentUser)
        const saved = data || []
        if (saved.length > 0) {
          const sorted = saved.map(({ slot, area, municipality, province }) => ({ slot, area, municipality, province }))
          setAreas(sorted)
          const selectedDefault = saved.find((item) => item.is_default) || saved[0]
          setDefaultKey(locationKey(selectedDefault))
          setSavedDefaultKey(locationKey(selectedDefault))
          setAreasAlreadySaved(true)
          setNotice('Your areas are already saved. You can continue to Amanzi.')
        }
      } catch {
        if (active) setError('We could not load your account or saved areas. Check your connection and try again.')
      } finally {
        if (active) setLoading(false)
        onLoadingChange('area-onboarding', false)
      }
    }
    loadAccountAreas()
    return () => { active = false; onLoadingChange('area-onboarding', false) }
  }, [supabase, onRequireSignIn, onLoadingChange])

  function addArea(nextArea) {
    setError('')
    setNotice('')
    if (areas.some((area) => locationMatches(area, nextArea))) {
      setNotice(`${nextArea.area} is already in your list.`)
      return
    }
    if (areas.length >= maxSavedAreas) {
      setNotice('You can save up to three areas. Remove one before adding another.')
      return
    }
    setAreas((current) => [...current, nextArea])
    if (areas.length === 0) setDefaultKey(locationKey(nextArea))
  }

  function removeArea(areaToRemove) {
    if (areasAlreadySaved) return
    const next = areas.filter((area) => !locationMatches(area, areaToRemove))
    setAreas(next)
    if (locationKey(areaToRemove) === defaultKey) setDefaultKey(next[0] ? locationKey(next[0]) : '')
    setError('')
    setNotice('')
  }

  async function saveAreas() {
    if (!user || !canContinue || saving) return
    setSaving(true)
    onLoadingChange('area-onboarding', true, 'Saving your communities…')
    setError('')
    setNotice('')
    try {
      if (areasAlreadySaved) {
        const selectedDefault = areas.find((area) => locationKey(area) === defaultKey)
        if (!selectedDefault) throw new Error('Choose a default area')
        if (defaultKey !== savedDefaultKey) {
          const { error: defaultError } = await supabase.rpc('set_default_user_area', { p_slot: selectedDefault.slot })
          if (defaultError) throw defaultError
        }
        try {
          localStorage.setItem('amanzi-location', JSON.stringify(selectedDefault))
          localStorage.setItem('amanzi-location-user', user.id)
        } catch { /* Account default remains available when local storage is blocked. */ }
        onComplete(selectedDefault)
        return
      }
      const rows = areas.map((area, index) => ({
        slot: index + 1,
        area: area.area,
        municipality: area.municipality,
        province: area.province,
        is_default: locationKey(area) === defaultKey,
      }))
      const { error: saveError } = await supabase.from('user_areas').insert(rows)
      if (saveError) throw saveError
      const selectedDefault = areas.find((area) => locationKey(area) === defaultKey)
      try {
        localStorage.setItem('amanzi-location', JSON.stringify(selectedDefault))
        localStorage.setItem('amanzi-location-user', user.id)
      } catch { /* Account default remains available when local storage is blocked. */ }
      onComplete(selectedDefault)
    } catch {
      setError('We could not save your areas. Please check your connection and try again.')
    } finally {
      setSaving(false)
      onLoadingChange('area-onboarding', false)
    }
  }

  return <main className="area-onboarding-page">
    <section className="area-onboarding-card" aria-labelledby="area-onboarding-title">
      <img className="account-brand-logo" src="/brand/amanzi-logo.png" alt="Amanzi" />
      <span className="area-onboarding-kicker">ONE LAST STEP</span>
      <h1 id="area-onboarding-title">Choose your communities</h1>
      <p className="area-onboarding-intro">Add up to three places you want to follow, such as home, work, or family. Your default area opens first when you return.</p>

      {loading ? <p className="area-onboarding-status" role="status">Checking your secure account…</p> : <>
        {areasAlreadySaved ? <p className="area-onboarding-status">Choose which of your saved areas should open first.</p> : <LocationSearch location={searchLocation} onChoose={addArea} disabled={!supabase || Boolean(error && !user)} label="Search South Africa" inputId="onboarding-location-search" />}

        <div className="area-onboarding-list-heading"><h2>Your areas</h2><span>{areas.length}/{maxSavedAreas}</span></div>
        {areas.length > 0 ? <fieldset className="area-onboarding-list"><legend className="sr-only">Choose your default community</legend>
          {areas.map((area) => {
            const key = locationKey(area)
            return <div className="area-onboarding-row" key={key}>
              <label className={`area-onboarding-choice${defaultKey === key ? ' is-default' : ''}`}>
                <input type="radio" name="default-area" value={key} checked={defaultKey === key} onChange={() => setDefaultKey(key)} />
                <span className="area-onboarding-copy"><strong>{area.area}</strong><small>{area.municipality}, {area.province}</small></span>
                {defaultKey === key && <span className="area-default-badge">Default</span>}
              </label>
              {!areasAlreadySaved && <button type="button" className="area-onboarding-remove" onClick={() => removeArea(area)} aria-label={`Remove ${area.area}`}>Remove</button>}
            </div>
          })}
        </fieldset> : <div className="area-onboarding-empty">Search for a suburb, town, or city to add your first area.</div>}
        {reachedLimit && <p className="area-onboarding-limit">Three areas saved. Remove an area before adding another.</p>}
        {notice && <p className="area-onboarding-status" role="status">{notice}</p>}
        {error && <p className="area-onboarding-error" role="alert">{error}</p>}
        <div className="area-onboarding-actions">
          <button type="button" className="area-onboarding-secondary" onClick={() => { if (areas.length > 0) onComplete(areas.find((area) => locationKey(area) === defaultKey)); else onRequireSignIn() }} disabled={saving}>{areas.length > 0 ? 'Continue to Amanzi' : 'Sign in again'}</button>
          <button type="button" className="post-button area-onboarding-submit" onClick={saveAreas} disabled={!canContinue || saving || !user}>{saving ? 'Saving your areas…' : areasAlreadySaved ? 'Confirm default and continue' : 'Save and continue'}</button>
        </div>
        <p className="area-onboarding-security">Your areas are private to your account. You can change them later, up to the same three-area limit.</p>
      </>}
    </section>
  </main>
}

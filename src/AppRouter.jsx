import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import App from './App'
import AreaOnboardingPage from './pages/AreaOnboardingPage'
import CreateAccountPage from './pages/CreateAccountPage'
import AboutPage from './pages/AboutPage'
import UsernameSetupPage from './pages/UsernameSetupPage'
import LoadingScreen from './components/feedback/LoadingScreen'
import ResetPasswordPage from './pages/ResetPasswordPage'

function readPath() {
  if (window.location.pathname === '/create-account') return 'create-account'
  if (window.location.pathname === '/reset-password') return 'reset-password'
  if (window.location.pathname === '/onboarding') return 'onboarding'
  if (window.location.pathname === '/username') return 'username'
  if (window.location.pathname === '/about') return 'about'
  return 'home'
}

export default function AppRouter() {
  const [page, setPage] = useState(readPath)
  const [routeLoading, setRouteLoading] = useState(readPath() === 'home')
  const [routeLabel, setRouteLabel] = useState('Checking your Amanzi account…')
  const [operations, setOperations] = useState({})
  const [sessionValidated, setSessionValidated] = useState(false)
  const routeTransitionStarted = useRef(0)
  const routeTransitionTimer = useRef(null)

  const beginRouteTransition = useCallback((label = 'Loading Amanzi…') => {
    window.clearTimeout(routeTransitionTimer.current)
    routeTransitionStarted.current = Date.now()
    setRouteLabel(label)
    setRouteLoading(true)
  }, [])

  const finishRouteTransition = useCallback(() => {
    window.clearTimeout(routeTransitionTimer.current)
    const remaining = Math.max(0, 650 - (Date.now() - routeTransitionStarted.current))
    routeTransitionTimer.current = window.setTimeout(() => setRouteLoading(false), remaining)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      beginRouteTransition('Opening this page…')
      setPage(readPath())
      finishRouteTransition()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [beginRouteTransition, finishRouteTransition])

  useEffect(() => () => window.clearTimeout(routeTransitionTimer.current), [])

  const navigate = useCallback((path) => {
    const shouldTransition = window.location.pathname !== path || (path === '/' && !sessionValidated)
    if (shouldTransition) {
      beginRouteTransition(path === '/' ? 'Opening your communities…' : 'Opening this page…')
    }
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setPage(readPath())
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (shouldTransition) finishRouteTransition()
  }, [beginRouteTransition, finishRouteTransition, sessionValidated])

  const routeAfterAuthentication = useCallback(async () => {
    beginRouteTransition('Opening your communities…')
    try {
      if (!supabase) { navigate('/create-account'); return }
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || user.is_anonymous) { navigate('/create-account'); return }
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('username').eq('user_id', user.id).maybeSingle()
      if (profileError || !profile?.username) {
        setSessionValidated(true)
        navigate('/username')
        return
      }
      const { data, error } = await supabase.from('user_areas').select('slot').limit(1)
      setSessionValidated(true)
      navigate(error || !data?.length ? '/onboarding' : '/')
    } catch {
      setSessionValidated(true)
      navigate('/onboarding')
    } finally {
      finishRouteTransition()
    }
  }, [beginRouteTransition, finishRouteTransition, navigate])

  const handleAccountReady = useCallback((user, level) => {
    if (user && !user.is_anonymous && level === 'aal2') void routeAfterAuthentication()
    else {
      setSessionValidated(false)
      if (!user) {
        setRouteLabel('Checking your Amanzi account…')
        setRouteLoading(true)
      }
    }
  }, [routeAfterAuthentication])

  const requireSignIn = useCallback(() => navigate('/create-account'), [navigate])
  const reportOperation = useCallback((id, active, label = 'Please wait…') => {
    setOperations((current) => {
      if (!active && !current[id]) return current
      const next = { ...current }
      if (active) next[id] = label
      else delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    if (page !== 'home' || sessionValidated) return undefined
    let active = true
    async function checkEntry() {
      try {
        if (!supabase) { navigate('/create-account'); return }
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        const user = data?.session?.user
        if (!user || user.is_anonymous) { navigate('/create-account'); return }
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        if (assurance.currentLevel !== 'aal2') { navigate('/create-account'); return }
        await routeAfterAuthentication()
      } catch {
        if (active) navigate('/create-account')
      } finally {
        if (active) finishRouteTransition()
      }
    }
    void checkEntry()
    return () => { active = false }
  }, [page, navigate, routeAfterAuthentication, sessionValidated, finishRouteTransition])

  let content
  if (page === 'create-account') {
    content = <CreateAccountPage supabase={supabase} onClose={() => navigate('/')} onAuthChange={handleAccountReady} onLoadingChange={reportOperation} />
  } else if (page === 'reset-password') {
    content = <ResetPasswordPage supabase={supabase} onSignIn={() => navigate('/create-account')} onLoadingChange={reportOperation} />
  } else if (page === 'onboarding') {
    content = <AreaOnboardingPage supabase={supabase} onComplete={() => navigate('/')} onRequireSignIn={requireSignIn} onLoadingChange={reportOperation} />
  } else if (page === 'username') {
    content = <UsernameSetupPage supabase={supabase} onComplete={routeAfterAuthentication} onRequireSignIn={requireSignIn} onLoadingChange={reportOperation} />
  } else if (page === 'about') {
    content = <AboutPage onHome={() => navigate('/')} />
  } else {
    content = <App onRequireAccount={requireSignIn} onLoadingChange={reportOperation} onNavigateAbout={() => navigate('/about')} />
  }

  const operationLabel = Object.values(operations)[0]
  return <>
    {content}
    <LoadingScreen active={routeLoading || Boolean(operationLabel)} label={operationLabel || routeLabel} delay={routeLoading ? 0 : 220} minDuration={650} />
  </>
}

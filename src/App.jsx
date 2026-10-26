import { useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { findMunicipalFaultContact } from './data/municipalFaultContacts'
import AccountMenu, { MobileSignOutButton } from './components/account/AccountMenu'
import LocationSearch from './components/community/LocationSearch'
import SortMenu from './components/community/SortMenu'
import SavedAreasPanel from './components/community/SavedAreasPanel'
import WaterSafetyCaseStudy from './components/community/WaterSafetyCaseStudy'
import OfficialNoticesPanel from './components/community/OfficialNoticesPanel'
import { locationKey, locationMatches, maxSavedAreas, readSavedLocation } from './lib/locations'
import { containsBlockedLanguage, MESSAGE_LANGUAGE_ERROR } from './lib/content-moderation'
import { getJudgeDemoUsername, isJudgeDemoUser } from './lib/judge-demo'
import locationIcon from './assets/status-icons/location.png'
import restoredIcon from './assets/status-icons/restored.png'
import lowPressureIcon from './assets/status-icons/low_pressure.png'
import noWaterIcon from './assets/status-icons/no_water.png'
import './App.css'
import './fault-report.css'
import './saved-areas.css'
import './brand-theme.css'
import './app-redesign.css'

const seed = [
  { id: 1, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'no_water', title: 'No water in parts of Phoenix', detail: 'Water has been off in our area since early this morning. Anyone else affected?', time: '8 min ago', author: 'Nandi M.', kind: 'Community update', replies: 12, confirms: 18, verified: false },
  { id: 2, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'restored', title: 'Water is back in Clayfield', detail: 'Our taps are running again. Pressure is still low on our side.', time: '21 min ago', author: 'Sihle P.', kind: 'Community update', replies: 6, confirms: 9, verified: false },
  { id: 3, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', title: 'Sample water interruption notice', detail: 'Demo content only. A real notice would show the municipality’s original message, affected areas and latest update time.', time: '42 min ago', author: 'Sample municipal notice', kind: 'Official notice · sample', replies: 4, confirms: 0, verified: true },
  { id: 4, area: 'Mount Edgecombe', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'low_pressure', title: 'Pressure is lower than usual', detail: 'Not completely off, but water is only coming through slowly in our block.', time: '1 hr ago', author: 'Ayesha K.', kind: 'Community update', replies: 3, confirms: 5, verified: false },
]

const waterStatuses = [
  { value: 'no_water', label: 'No water', description: 'The taps are dry', icon: noWaterIcon },
  { value: 'low_pressure', label: 'Low pressure', description: 'Water is running slowly', icon: lowPressureIcon },
  { value: 'restored', label: 'Water restored', description: 'Water is back on', icon: restoredIcon },
  { value: 'water_safety_concern', label: 'Water safety concern', description: 'Report an unusual observation', icon: null },
]
const waterStatusLabels = Object.fromEntries(waterStatuses.map(({ value, label }) => [value, label]))
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelativeTime(timestamp, now = Date.now()) {
  const createdAt = new Date(timestamp).getTime()
  if (!Number.isFinite(createdAt)) return ''

  const ageMinutes = Math.max(0, Math.floor((now - createdAt) / 60_000))
  if (ageMinutes < 1) return 'Just now'
  if (ageMinutes < 60) return relativeTimeFormatter.format(-ageMinutes, 'minute')

  const ageHours = Math.floor(ageMinutes / 60)
  if (ageHours < 24) return relativeTimeFormatter.format(-ageHours, 'hour')

  const ageDays = Math.floor(ageHours / 24)
  if (ageDays < 7) return relativeTimeFormatter.format(-ageDays, 'day')
  if (ageDays < 30) return relativeTimeFormatter.format(-Math.floor(ageDays / 7), 'week')

  const ageMonths = Math.floor(ageDays / 30)
  if (ageMonths < 12) return relativeTimeFormatter.format(-ageMonths, 'month')
  return relativeTimeFormatter.format(-Math.floor(ageDays / 365), 'year')
}

function formatPostRelativeTime(post, now = Date.now()) {
  const legacyTime = String(post.time || '')
  if (post.createdAt) return formatRelativeTime(post.createdAt, now) || legacyTime
  const match = legacyTime.match(/^(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+ago$/i)
  if (!match) return legacyTime
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const unitMinutes = unit.startsWith('month') ? 43_200 : unit.startsWith('min') ? 1 : unit.startsWith('m') ? 43_200 : unit.startsWith('h') ? 60 : unit.startsWith('d') ? 1_440 : unit.startsWith('w') ? 10_080 : 525_600
  return formatRelativeTime(now - amount * unitMinutes * 60_000, now)
}

function App({ onRequireAccount, onLoadingChange, onNavigateAbout }) {
  const [posts, setPosts] = useState(() => {
    if (isSupabaseConfigured) return []
    try {
      const savedPosts = JSON.parse(localStorage.getItem('amanzi-updates'))
      return Array.isArray(savedPosts) ? savedPosts.map((post) => ({ ...post, municipality: post.municipality || 'eThekwini', province: post.province || 'KwaZulu-Natal' })) : seed
    } catch { return seed }
  })
  const [location, setLocation] = useState(readSavedLocation)
  const { area, municipality, province } = location
  const [scope, setScope] = useState('nearby')
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [renderComposer, setRenderComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftArea, setDraftArea] = useState('Phoenix')
  const [draftMunicipality, setDraftMunicipality] = useState('eThekwini')
  const [draftProvince, setDraftProvince] = useState('KwaZulu-Natal')
  const [draftStatus, setDraftStatus] = useState('')
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false)
  const [notice, setNotice] = useState('')
  const [dbStatus, setDbStatus] = useState(isSupabaseConfigured ? 'connecting' : 'demo')
  const [dbMessage, setDbMessage] = useState('')
  const [chatArea, setChatArea] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [renderChat, setRenderChat] = useState(false)
  const [showFaultReport, setShowFaultReport] = useState(false)
  const [renderFaultReport, setRenderFaultReport] = useState(false)
  const [faultContact, setFaultContact] = useState(null)
  const composerTimer = useRef(null)
  const chatTimer = useRef(null)
  const faultReportTimer = useRef(null)
  const mobileMenuCloseTimer = useRef(null)
  const [authUser, setAuthUser] = useState(null)
  const [authLevel, setAuthLevel] = useState('guest')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuRendered, setMobileMenuRendered] = useState(false)
  const [mobilePage, setMobilePage] = useState('home')
  const [showWaterSafetyCaseStudy, setShowWaterSafetyCaseStudy] = useState(false)
  const [usernames, setUsernames] = useState({})
  const [savedAreas, setSavedAreas] = useState([])
  const [savedAreasLoading, setSavedAreasLoading] = useState(false)
  const [savedAreasBusy, setSavedAreasBusy] = useState(false)
  const [savedAreasMessage, setSavedAreasMessage] = useState('')
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [sortMode, setSortMode] = useState('newest')
  const currentUsername = authUser ? usernames[authUser.id] || authUser.user_metadata?.username || getJudgeDemoUsername(authUser) : ''
  const canContribute = Boolean(authUser && !authUser.is_anonymous && authLevel === 'aal2')

  useEffect(() => () => {
    window.clearTimeout(composerTimer.current)
    window.clearTimeout(chatTimer.current)
    window.clearTimeout(faultReportTimer.current)
    window.clearTimeout(mobileMenuCloseTimer.current)
  }, [])

  function openMobileMenu() {
    window.clearTimeout(mobileMenuCloseTimer.current)
    setMobileMenuRendered(true)
    setMobileMenuOpen(true)
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
    window.clearTimeout(mobileMenuCloseTimer.current)
    mobileMenuCloseTimer.current = window.setTimeout(() => setMobileMenuRendered(false), 190)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        window.clearTimeout(mobileMenuCloseTimer.current)
        mobileMenuCloseTimer.current = window.setTimeout(() => setMobileMenuRendered(false), 190)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileMenuOpen])

  function closeComposer() {
    setShowComposer(false)
    window.clearTimeout(composerTimer.current)
    composerTimer.current = window.setTimeout(() => setRenderComposer(false), 180)
  }

  function closeChat() {
    setShowChat(false)
    window.clearTimeout(chatTimer.current)
    chatTimer.current = window.setTimeout(() => {
      setRenderChat(false)
      setChatArea(null)
    }, 180)
  }

  function openFaultReport(contact) {
    window.clearTimeout(faultReportTimer.current)
    setFaultContact(contact)
    setRenderFaultReport(true)
    setShowFaultReport(true)
  }

  async function startFaultReport() {
    closeMobileMenu()
    onLoadingChange?.('mobile-fault-contact', true, 'Finding local water support…')
    try {
      openFaultReport(await findMunicipalFaultContact(location))
    } catch {
      setNotice('Could not load water support details. Please try again.')
    } finally {
      onLoadingChange?.('mobile-fault-contact', false)
    }
  }

  function closeFaultReport() {
    setShowFaultReport(false)
    window.clearTimeout(faultReportTimer.current)
    faultReportTimer.current = window.setTimeout(() => {
      setRenderFaultReport(false)
      setFaultContact(null)
    }, 180)
  }

  function guardGuestInteraction(event) {
    if (authUser && !authUser.is_anonymous) return
    const target = event.target instanceof Element ? event.target.closest('a,button,input,textarea,select,[role="button"],[tabindex]') : null
    if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()
    event.stopPropagation()
    onRequireAccount()
  }

  function requireAccountOrMfa() {
    if (isJudgeDemoUser(authUser)) {
      setNotice('Judge preview is read-only. Sign in with a resident account to post, confirm, chat, or save areas.')
      return
    }
    onRequireAccount()
  }

  useEffect(() => {
    if (!supabase || !authUser || authUser.is_anonymous || authLevel !== 'aal2') return undefined
    let active = true
    supabase.from('user_areas').select('slot, area, municipality, province, is_default').order('slot')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setSavedAreasMessage('Could not load saved areas. Please try again.')
          setSavedAreas([])
        } else {
          const areas = data || []
          setSavedAreas(areas)
          if (areas.length > 0) {
            setLocation((current) => {
              let sameAccountLocation = false
              try { sameAccountLocation = localStorage.getItem('amanzi-location-user') === authUser.id } catch { /* Use the account default when local storage is unavailable. */ }
              const selected = (sameAccountLocation && areas.find((savedArea) => locationMatches(savedArea, current))) || areas.find((savedArea) => savedArea.is_default) || areas[0]
              try {
                localStorage.setItem('amanzi-location', JSON.stringify(selected))
                localStorage.setItem('amanzi-location-user', authUser.id)
              } catch { /* The saved account area still works for this session. */ }
              return selected
            })
          }
        }
        setSavedAreasLoading(false)
      })
      .catch(() => {
        if (active) {
          setSavedAreasMessage('Could not load saved areas. Please try again.')
          setSavedAreasLoading(false)
        }
      })
    return () => { active = false }
  }, [authUser, authLevel])

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  async function saveCurrentArea(areaToSave = location) {
    if (!canContribute) { onRequireAccount(); return false }
    if (savedAreasBusy || savedAreasLoading) return false
    if (savedAreas.some((savedArea) => locationMatches(savedArea, areaToSave))) {
      setSavedAreasMessage(`${areaToSave.area} is already saved to this account.`)
      return false
    }
    if (savedAreas.length >= maxSavedAreas) {
      setSavedAreasMessage('You’ve reached the three-area limit. Remove an area before adding another.')
      return false
    }
    if (!areaToSave?.area || !areaToSave?.municipality || !areaToSave?.province) return false
    const occupiedSlots = new Set(savedAreas.map(({ slot }) => slot))
    const slot = [1, 2, 3].find((candidate) => !occupiedSlots.has(candidate))
    setSavedAreasBusy(true)
    setSavedAreasMessage('')
    try {
      const { data, error } = await supabase.from('user_areas').insert({
        slot,
        area: areaToSave.area,
        municipality: areaToSave.municipality,
        province: areaToSave.province,
        is_default: savedAreas.length === 0,
      }).select('slot, area, municipality, province, is_default').single()
      if (error) {
        setSavedAreasMessage(error.code === '23505' ? 'That area is already saved to this account.' : 'Could not save this area. Please try again.')
        return false
      }
      setSavedAreas((current) => [...current, data].sort((left, right) => left.slot - right.slot))
      setSavedAreasMessage(`${data.area} is saved to your account.`)
      return true
    } catch {
      setSavedAreasMessage('Amanzi could not reach the server. Check your connection and try again.')
      return false
    } finally {
      setSavedAreasBusy(false)
    }
  }

  async function removeSavedArea(savedArea) {
    if (!canContribute || savedAreasBusy) return
    setSavedAreasBusy(true)
    setSavedAreasMessage('')
    try {
      const remaining = savedAreas.filter((item) => item.slot !== savedArea.slot).sort((left, right) => left.slot - right.slot)
      const nextDefault = remaining[0]
      if (savedArea.is_default && nextDefault) {
        const { error: defaultError } = await supabase.rpc('set_default_user_area', { p_slot: nextDefault.slot })
        if (defaultError) throw defaultError
        setSavedAreas((current) => current.map((item) => ({ ...item, is_default: item.slot === nextDefault.slot })))
      }
      const { error } = await supabase.from('user_areas').delete().eq('slot', savedArea.slot)
      if (error) {
        setSavedAreasMessage('Could not remove this area. Please try again.')
        return
      }
      setSavedAreas((current) => current.filter((item) => item.slot !== savedArea.slot))
      if (nextDefault && locationMatches(location, savedArea)) chooseLocation(nextDefault)
      setSavedAreasMessage(`${savedArea.area} was removed from your saved areas.`)
    } catch {
      setSavedAreasMessage('Amanzi could not reach the server. Check your connection and try again.')
    } finally {
      setSavedAreasBusy(false)
    }
  }

  async function setDefaultArea(savedArea) {
    if (!canContribute || savedAreasBusy || savedArea.is_default) return
    setSavedAreasBusy(true)
    setSavedAreasMessage('')
    try {
      const { error } = await supabase.rpc('set_default_user_area', { p_slot: savedArea.slot })
      if (error) throw error
      setSavedAreas((current) => current.map((item) => ({ ...item, is_default: item.slot === savedArea.slot })))
      chooseLocation(savedArea)
      setSavedAreasMessage(`${savedArea.area} is now your default area.`)
    } catch {
      setSavedAreasMessage('Could not change your default area. Please try again.')
    } finally {
      setSavedAreasBusy(false)
    }
  }

  async function loadSharedUpdates() {
    const [{ data: updates, error: updatesError }, { data: demoUpdates, error: demoUpdatesError }, { data: confirmations, error: confirmationsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from('water_updates').select('id, area, municipality, province, message, water_status, display_name, created_by, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('demo_water_updates').select('id, area, municipality, province, message, water_status, username, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('update_confirmations').select('update_id, user_id'),
      supabase.from('profiles').select('user_id, username').not('username', 'is', null),
    ])
    if (updatesError) throw updatesError
    if (demoUpdatesError) throw demoUpdatesError
    if (confirmationsError) throw confirmationsError
    if (profilesError) throw profilesError
    const profileNames = Object.fromEntries((profiles || []).map(({ user_id, username }) => [user_id, username]))
    setUsernames(profileNames)
    const counts = new Map()
    for (const confirmation of confirmations) counts.set(confirmation.update_id, (counts.get(confirmation.update_id) || 0) + 1)
    const locations = new Map(updates.map((row) => [locationKey(row), row]))
    const chatCounts = new Map(await Promise.all([...locations.values()].map(async (updateLocation) => {
      const { count, error } = await supabase.from('community_messages').select('id', { count: 'exact', head: true })
        .eq('area', updateLocation.area).eq('municipality', updateLocation.municipality).eq('province', updateLocation.province)
      if (error) throw error
      return [locationKey(updateLocation), count || 0]
    })))
    const sharedPosts = updates.filter((row) => profileNames[row.created_by] || (row.display_name && row.display_name !== 'Neighbour')).map((row) => ({
      id: row.id,
      area: row.area,
      municipality: row.municipality,
      province: row.province,
      waterStatus: row.water_status,
      createdAt: row.created_at,
      title: row.message,
      detail: `Shared by ${profileNames[row.created_by] || 'a neighbour'} in ${row.area}.`,
      time: formatRelativeTime(row.created_at),
      author: profileNames[row.created_by] || row.display_name || 'Neighbour',
      kind: 'Community update',
      replies: chatCounts.get(locationKey(row)) || 0,
      confirms: counts.get(row.id) || 0,
      verified: false,
    }))
    const samplePosts = (demoUpdates || []).map((row) => ({
      id: `sample-${row.id}`,
      area: row.area,
      municipality: row.municipality,
      province: row.province,
      waterStatus: row.water_status,
      createdAt: row.created_at,
      title: row.message,
      detail: 'Example only. This sample is not a live report about current water service.',
      time: formatRelativeTime(row.created_at),
      author: row.username,
      kind: 'Sample update',
      replies: 0,
      confirms: 0,
      verified: false,
      isDemo: true,
    }))
    setPosts([...sharedPosts, ...samplePosts].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)))
    setDbStatus('connected')
  }

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    let channel
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null
      if (!active) return
      setAuthUser(nextUser)
      setSavedAreas([])
      setSavedAreasLoading(Boolean(nextUser && !nextUser.is_anonymous))
      setSavedAreasMessage('')
      if (!nextUser || nextUser.is_anonymous) {
        setAuthLevel('guest')
        setSavedAreasLoading(false)
        return
      }
      if (isJudgeDemoUser(nextUser)) {
        setAuthLevel('judge-demo')
        setSavedAreasLoading(false)
        return
      }
      window.setTimeout(() => {
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
          if (active) {
            if (error) {
              setSavedAreasLoading(false)
              return
            }
            setAuthLevel(data.currentLevel)
            setSavedAreasLoading(data.currentLevel === 'aal2')
            if (data.currentLevel !== 'aal2') onRequireAccount()
          }
        }).catch(() => {})
      }, 0)
    })
    async function connect() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (session?.user?.is_anonymous) {
        await supabase.auth.signOut()
        if (active) { setAuthUser(null); setAuthLevel('guest') }
      } else if (!session?.user) {
        if (active) { setAuthUser(null); setAuthLevel('guest') }
      } else {
        setAuthUser(session.user)
        if (!session.user.is_anonymous) {
          if (isJudgeDemoUser(session.user)) {
            setAuthLevel('judge-demo')
            setSavedAreasLoading(false)
          } else {
          const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (assuranceError) throw assuranceError
          if (active) {
            setAuthLevel(assurance.currentLevel)
            setSavedAreasLoading(assurance.currentLevel === 'aal2')
            if (assurance.currentLevel !== 'aal2') onRequireAccount()
          }
          }
        }
      }
      if (!active) return
      await loadSharedUpdates()
      const channelName = `amanzi-water-updates-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
      channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'water_updates' }, () => loadSharedUpdates().catch(() => {}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'update_confirmations' }, () => loadSharedUpdates().catch(() => {}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => loadSharedUpdates().catch(() => {}))
        .subscribe()
    }
    onLoadingChange?.('load-shared-feed', true, 'Loading your community…')
    connect().catch(() => {
      if (!active) return
      setDbStatus('error')
      setDbMessage('Please check your connection and try again.')
    }).finally(() => onLoadingChange?.('load-shared-feed', false))
    return () => {
      active = false
      subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [onLoadingChange, onRequireAccount])

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter((post) => {
    const inScope = scope === 'nearby' ? locationMatches(post, location) : true
    const matches = `${post.title} ${post.detail} ${post.area}`.toLowerCase().includes(query.toLowerCase())
    return inScope && matches
    })
    return [...filtered].sort((left, right) => {
      if (sortMode === 'confirmed') return (right.confirms || 0) - (left.confirms || 0)
      if (sortMode === 'oldest') return posts.indexOf(right) - posts.indexOf(left)
      return posts.indexOf(left) - posts.indexOf(right)
    })
  }, [posts, location, scope, query, sortMode])
  const areaPosts = posts.filter((post) => locationMatches(post, location) && !post.verified && !post.isDemo)

  function save(next) {
    setPosts(next)
    if (!supabase) localStorage.setItem('amanzi-updates', JSON.stringify(next))
  }

  async function publish(event) {
    event.preventDefault()
    if (supabase && !canContribute) {
      requireAccountOrMfa()
      return
    }
    if (draft.trim().length < 8 || !draftStatus || (draftStatus === 'water_safety_concern' && !safetyAcknowledged) || draftArea.trim().length < 2 || draftMunicipality.trim().length < 2) return
    if (supabase) {
      if (dbStatus !== 'connected') {
        setNotice('Amanzi is not connected, so this update was not shared. Refresh after Supabase is enabled.')
        return
      }
      onLoadingChange?.('publish-update', true, 'Sharing your update…')
      try {
        const { data: insertedUpdate, error } = await supabase.from('water_updates').insert({ area: draftArea.trim(), municipality: draftMunicipality.trim(), province: draftProvince, message: draft.trim(), water_status: draftStatus, display_name: currentUsername }).select('id').single()
        if (error) throw error
        supabase.functions.invoke('dispatch-water-alert', { body: { updateId: insertedUpdate.id } }).catch(() => {})
        await loadSharedUpdates()
        setDraft('')
        closeComposer()
        setNotice(`Your update is now shared with ${draftArea}, ${draftMunicipality}, ${draftProvince}.`)
      } catch {
        setNotice('Could not post right now. Please try again.')
        return
      } finally {
        onLoadingChange?.('publish-update', false)
      }
      window.setTimeout(() => setNotice(''), 3500)
      return
    }
    const next = [{ id: Date.now(), area: draftArea.trim(), municipality: draftMunicipality.trim(), province: draftProvince, waterStatus: draftStatus, title: draft.trim().slice(0, 72), detail: 'Shared with your local Amanzi community. Add a reply if you have more context.', time: 'Just now', createdAt: new Date().toISOString(), author: currentUsername || 'You', kind: 'Community update', replies: 0, confirms: 0, verified: false }, ...posts]
    save(next)
    setDraft('')
    closeComposer()
    setNotice(`Your update is now visible to ${draftArea}, ${draftMunicipality}, ${draftProvince}.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function confirm(id) {
    if (supabase) {
      if (!canContribute) {
        requireAccountOrMfa()
        return
      }
      if (dbStatus !== 'connected') {
        setNotice('Amanzi is not connected, so this confirmation was not saved.')
        return
      }
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw userError || new Error('No authenticated user')
        const { error } = await supabase.from('update_confirmations').insert({ update_id: id, user_id: user.id })
        if (error?.code === '23505') setNotice('You’ve already confirmed this update.')
        else if (error) setNotice('Could not confirm right now. Please try again.')
        else {
          supabase.functions.invoke('dispatch-water-alert', { body: { updateId: id } }).catch(() => {})
          await loadSharedUpdates()
        }
      } catch {
        setNotice('Could not confirm right now. Check your connection and try again.')
      }
      window.setTimeout(() => setNotice(''), 3500)
      return
    }
    save(posts.map((post) => post.id === id ? { ...post, confirms: post.confirms + 1 } : post))
  }

  function chooseLocation(nextLocation) {
    const cleanLocation = { area: nextLocation.area.trim(), municipality: nextLocation.municipality.trim(), province: nextLocation.province }
    setLocation(cleanLocation)
    try {
      localStorage.setItem('amanzi-location', JSON.stringify(cleanLocation))
      if (authUser && !authUser.is_anonymous) localStorage.setItem('amanzi-location-user', authUser.id)
    } catch { /* Area selection still works for this session. */ }
  }

  function openComposer(target = location) {
    if (supabase && !canContribute) {
      requireAccountOrMfa()
      return
    }
    setDraftArea(target.area)
    setDraftMunicipality(target.municipality)
    setDraftProvince(target.province)
    window.clearTimeout(composerTimer.current)
    setRenderComposer(true)
    setShowComposer(true)
  }

  function openChat(post) {
    window.clearTimeout(chatTimer.current)
    setChatArea(post)
    setRenderChat(true)
    setShowChat(true)
  }

  async function shareUpdate(post) {
    const title = 'Amanzi community update'
    const text = `${post.title}\n${post.area}, ${post.municipality}, ${post.province}\nShared on Amanzi.`
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        setNotice('Update shared.')
        window.setTimeout(() => setNotice(''), 3500)
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`)
      } else {
        const field = document.createElement('textarea')
        field.value = `${text}\n${url}`
        field.setAttribute('readonly', '')
        field.style.position = 'fixed'
        field.style.opacity = '0'
        document.body.appendChild(field)
        field.select()
        const copied = document.execCommand('copy')
        field.remove()
        if (!copied) throw new Error('Clipboard copy was unavailable')
      }
      setNotice('Update details and link copied to clipboard.')
    } catch {
      setNotice('Sharing is unavailable here. Copy the page address to share Amanzi.')
    }
    window.setTimeout(() => setNotice(''), 3500)
  }

  return (
      <div className="app-shell" onClickCapture={guardGuestInteraction} onFocusCapture={guardGuestInteraction} onSubmitCapture={guardGuestInteraction}>
      <header className="topbar">
        <button className="mobile-menu-trigger" type="button" aria-label="Open navigation menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={openMobileMenu}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <a className="brand" href="/" aria-label="Amanzi home" onClick={(event) => { event.preventDefault(); setMobilePage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><img className="brand-logo" src="/brand/amanzi-logo.png" alt="Amanzi" /></a>
        <div className="topbar-context"><span className="topbar-context-label">YOUR AREA</span><strong>{area}</strong><span>{municipality}</span></div>
        <AccountMenu user={authUser} supabase={supabase} onRequireAccount={onRequireAccount} onLoadingChange={onLoadingChange} />
      </header>

      {mobileMenuRendered && <div className="mobile-menu-backdrop" data-open={mobileMenuOpen} onPointerDown={(event) => { if (event.target === event.currentTarget) closeMobileMenu() }}>
        <nav className="mobile-navigation" id="mobile-navigation" aria-label="Main navigation" aria-modal="true" role="dialog" aria-hidden={!mobileMenuOpen} inert={!mobileMenuOpen}>
          <div className="mobile-navigation-heading"><span className="eyebrow">AMANZI MENU</span></div>
          <button type="button" className={`mobile-navigation-item ${mobilePage === 'home' ? 'active' : ''}`} onClick={() => { setMobilePage('home'); closeMobileMenu() }}><span className="mobile-navigation-item-icon"><img src="/brand/menu-icons/home_community.png" alt="" /></span><span><strong>Community updates</strong><small>See what neighbours are reporting</small></span></button>
          <button type="button" className={`mobile-navigation-item ${mobilePage === 'areas' ? 'active' : ''}`} onClick={() => { setMobilePage('areas'); closeMobileMenu() }}><span className="mobile-navigation-item-icon"><img src="/brand/menu-icons/location.png" alt="" /></span><span><strong>My areas</strong><small>Manage your saved communities</small></span></button>
          <button type="button" className="mobile-navigation-item" onClick={() => void startFaultReport()}><span className="mobile-navigation-item-icon"><img src="/brand/menu-icons/report.png" alt="" /></span><span><strong>Report a water fault</strong><small>Prepare a report for your water service</small></span></button>
          <section className="mobile-notices-info" aria-label="Water safety response case study">
            <h2>Water safety response</h2>
            <p>See how community reports and official warnings should work together during a water safety incident.</p>
            <button type="button" onClick={() => { closeMobileMenu(); setShowWaterSafetyCaseStudy(true) }}>View Bronkhorstspruit case study <span aria-hidden="true">↗</span></button>
          </section>
          <a className="mobile-navigation-about" href="/about" onClick={(event) => { event.preventDefault(); closeMobileMenu(); onNavigateAbout?.() }}>About Amanzi <span aria-hidden="true">↗</span></a>
          <MobileSignOutButton user={authUser} supabase={supabase} onRequireAccount={onRequireAccount} onLoadingChange={onLoadingChange} onClose={closeMobileMenu} />
        </nav>
      </div>}

      {mobilePage === 'areas' ? <main className="mobile-areas-page">
        <div className="mobile-areas-intro"><span className="eyebrow">YOUR COMMUNITIES</span><h1>My areas</h1><p>Choose the places you want to follow. You can save up to three areas.</p></div>
        {supabase && dbStatus === 'connected' ? <SavedAreasPanel key={authUser?.id || 'guest'} supabase={supabase} location={location} areas={savedAreas} loading={savedAreasLoading} busy={savedAreasBusy} message={savedAreasMessage} canManage={canContribute} signedIn={Boolean(authUser && !authUser.is_anonymous)} searchDisabled={dbStatus !== 'connected'} onSave={saveCurrentArea} onSelect={chooseLocation} onRemove={removeSavedArea} onSetDefault={setDefaultArea} onRequireAccount={requireAccountOrMfa} /> : <div className="mobile-areas-unavailable">{dbStatus === 'connecting' ? 'Connecting to your saved areas…' : 'Saved areas are unavailable while Amanzi is offline.'}</div>}
      </main> : <main id="home" className="layout">
        <section className="feed-column">
          <div className="welcome-row"><div><p className="eyebrow">{area.toUpperCase()} <span>·</span> {municipality.toUpperCase()}, {province.toUpperCase()}</p><h1>Good day, {currentUsername || 'neighbour'}.</h1><p className="intro">What’s happening with water around you?</p></div><button className="post-button uiverse-action" onClick={() => openComposer()}><span className="uiverse-action-label">Share an update</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button><svg className="hero-watermark" viewBox="0 0 180 120" aria-hidden="true"><path d="M16 72c22 20 49 30 76 24 23-5 35-26 53-37 9-6 18-8 25-3-5-18-19-31-36-31-21 0-30 19-46 31-22 17-49 18-72 16Z" fill="currentColor"/><path d="M44 88c29 11 67 8 97-12" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></svg></div>
          <section className="community-search-panel" aria-labelledby="community-search-title">
            <div className="community-search-current"><span className="community-search-pin" aria-hidden="true"><img src={locationIcon} alt="" /></span><div><span className="community-search-overline">YOUR COMMUNITY</span><strong id="community-search-title">{area}</strong><small>{municipality}, {province}</small></div></div>
            <LocationSearch location={location} onChoose={chooseLocation} disabled={dbStatus !== 'connected'} />
          </section>
          <div className="feed-toolbar"><div className="feed-tabs"><button className={scope === 'nearby' ? 'selected' : ''} onClick={() => setScope('nearby')}>My area <span>{areaPosts.length}</span></button><button className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')}>Across South Africa</button></div><label className="search-box uiverse-input-shell"><svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4 4"/></svg><input type="search" aria-label="Search updates" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search updates" /></label></div>

          <OfficialNoticesPanel supabase={supabase} user={authUser} location={location} />

          {isJudgeDemoUser(authUser) && <div className="judge-preview-banner" role="status"><strong>Judge preview</strong><span>Read-only access. Sample updates are labelled and do not describe live service conditions.</span></div>}

          {dbStatus === 'connecting' && <div className="toast" role="status">Connecting to Amanzi’s shared community updates…</div>}
          {dbStatus === 'error' && <div className="toast" role="status">Shared updates aren’t available: {dbMessage}. You can still explore the demo view.</div>}
          {notice && <div className="toast" role="status">✓ {notice}</div>}
          {renderComposer && <form className="composer" data-open={showComposer} inert={!showComposer} onSubmit={publish}>
            <div className="composer-head"><span className="composer-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5S6.5 10 6.5 14.3a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z"/><path d="M9.5 15.2a2.7 2.7 0 0 0 2.7 2.7"/></svg></span><div className="composer-heading-copy"><span className="composer-kicker">COMMUNITY UPDATE</span><strong>{scope === 'all' ? 'Share across South Africa' : `Share with ${area}`}</strong><small>Help neighbours understand what’s happening. Don’t include your exact address.</small></div><button type="button" className="composer-close" onClick={closeComposer} aria-label="Close update form"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>
            {scope === 'all' && <fieldset className="choice-group nationwide-report-location"><legend>Where is this happening?</legend><div className="report-location-current"><span>REPORT LOCATION</span><strong>{draftArea}</strong><small>{draftMunicipality}, {draftProvince}</small></div><LocationSearch location={{ area: draftArea, municipality: draftMunicipality, province: draftProvince }} onChoose={(next) => { setDraftArea(next.area); setDraftMunicipality(next.municipality); setDraftProvince(next.province) }} disabled={dbStatus !== 'connected'} inputId="report-community-search" label="Search to change the report location" /></fieldset>}
            <fieldset className="choice-group status-choice-group"><legend>What’s happening with the water?<span>Select one status</span></legend><div className="status-choices">{waterStatuses.map((status) => <label className={`status-choice ${draftStatus === status.value ? `selected status-${status.value}` : ''}`} key={status.value}><input type="radio" name="water-status" value={status.value} checked={draftStatus === status.value} onChange={() => { setDraftStatus(status.value); setSafetyAcknowledged(false) }} /><span className="status-choice-icon" aria-hidden="true">{status.icon ? <img src={status.icon} alt="" /> : <svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="M12 8v4m0 3h.01"/></svg>}</span><span className="status-choice-copy"><strong>{status.label}</strong><small>{status.description}</small></span><span className="choice-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.2 3 3 6-6.2"/></svg></span></label>)}</div></fieldset>
            {draftStatus === 'water_safety_concern' && <div className="water-safety-report-note"><strong>Report what you observed, not a safety conclusion.</strong><p>Amanzi cannot test water. This community post is not an official warning and does not reach the municipality.</p><label><input type="checkbox" checked={safetyAcknowledged} onChange={(event) => setSafetyAcknowledged(event.target.checked)} /> I understand this is an unverified observation, not proof that water is safe or unsafe.</label></div>}
            <label className="composer-field-label" htmlFor="update-details">What have you noticed?</label><div className="composer-editor"><textarea id="update-details" autoFocus minLength={8} maxLength={180} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add useful context, like when it started or if water has returned…" /><div className="composer-editor-foot"><span>Keep it brief and useful for neighbours.</span><span>{draft.length}/180</span></div></div>
            <div className="composer-foot"><span className="composer-location-summary"><strong>{draftArea}</strong><small>{draftMunicipality} · {waterStatusLabels[draftStatus] || 'Choose a water status'}</small></span><button className="post-button small composer-submit" disabled={draft.trim().length < 8 || !draftStatus || (draftStatus === 'water_safety_concern' && !safetyAcknowledged) || draftArea.trim().length < 2 || draftMunicipality.trim().length < 2}><span>Post update</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5"/></svg></button></div>
          </form>}

          <div className="feed-heading"><h2>Latest from your community</h2><SortMenu value={sortMode} onChange={setSortMode} /></div>
          <div className="posts-list">{visiblePosts.map((post) => <article className="post-card" key={post.id}>
            <div className="post-top"><div className={`post-type ${post.verified ? 'official' : ''}`}><span>{post.verified ? '✓' : '◉'}</span>{post.kind}{post.waterStatus && post.waterStatus !== 'unclassified' && <span className={`water-status-tag status-${post.waterStatus}`}>{waterStatusLabels[post.waterStatus]}</span>}</div><button className="more-button" aria-label="More options">···</button></div>
            <h3>{post.title}</h3><p className="post-detail">{post.detail}</p>
            {post.verified && <a className="source-link" href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">View municipal source <span>↗</span></a>}
            <div className="post-meta"><span className="mini-avatar">{post.author === 'You' ? 'T' : post.author.charAt(0)}</span><strong>{post.author}</strong><span className="meta-dot">·</span><span>{post.area}, {post.municipality}, {post.province}</span><span className="meta-dot">·</span><time dateTime={post.createdAt || undefined}>{formatPostRelativeTime(post, clockNow)}</time></div>
            <div className="post-actions"><button disabled={post.isDemo} title={post.isDemo ? 'Sample updates cannot be confirmed' : undefined} onClick={() => confirm(post.id)}><span>◉</span> I’m seeing this too <b>{post.confirms}</b></button><button disabled={post.isDemo} title={post.isDemo ? 'Sample updates do not have live chats' : undefined} onClick={() => openChat(post)}><span>◌</span> Join area chat <b title={`${post.replies} messages in ${post.area} chat`}>{post.replies}</b></button><button className="share-action" onClick={() => void shareUpdate(post)}><span>↗</span> Share</button></div>
          </article>)}
          {visiblePosts.length === 0 && <div className="empty-state"><div>⌕</div><strong>No updates found</strong><p>Try another search or check a wider area.</p></div>}
          </div>
        </section>

        <aside className="right-rail">
          <div className="desktop-only-notice-card"><div className="rail-card notice-card"><div className="notice-label"><span>i</span> WATER SAFETY RESPONSE</div><h3>Reports and warnings have different roles</h3><p>Community observations can highlight concern. Only a linked notice from the responsible authority can set official safety guidance.</p><button className="water-safety-case-study-link" type="button" onClick={() => setShowWaterSafetyCaseStudy(true)}>See the Bronkhorstspruit case study <span>↗</span></button></div></div>
          <div className="desktop-only-fault-card"><WaterFaultCard location={location} onReport={() => findMunicipalFaultContact(location).then(openFaultReport)} /></div>
          {supabase && dbStatus === 'connected' && <div className="desktop-only-saved-areas"><SavedAreasPanel key={authUser?.id || 'guest'} supabase={supabase} location={location} areas={savedAreas} loading={savedAreasLoading} busy={savedAreasBusy} message={savedAreasMessage} canManage={canContribute} signedIn={Boolean(authUser && !authUser.is_anonymous)} searchDisabled={dbStatus !== 'connected'} onSave={saveCurrentArea} onSelect={chooseLocation} onRemove={removeSavedArea} onSetDefault={setDefaultArea} onRequireAccount={requireAccountOrMfa} /></div>}
        </aside>
      </main>}
      {renderFaultReport && faultContact && <WaterFaultReport location={location} contact={faultContact} isOpen={showFaultReport} onClose={closeFaultReport} />}
      <WaterSafetyCaseStudy isOpen={showWaterSafetyCaseStudy} onClose={() => setShowWaterSafetyCaseStudy(false)} />
          {renderChat && chatArea && <CommunityChat initialLocation={chatArea} isOpen={showChat} onClose={closeChat} dbStatus={dbStatus} canContribute={canContribute} onRequireAccount={requireAccountOrMfa} onLoadingChange={onLoadingChange} usernames={usernames} currentUsername={currentUsername} />}
      <footer className="footer"><span>© 2026 Amanzi</span><span>Community-powered water updates for South Africa</span><a className="footer-about" href="/about" onClick={(event) => { event.preventDefault(); onNavigateAbout?.() }}>About Amanzi</a></footer>
    </div>
  )
}

const faultTypes = ['No water / outage', 'Water leak', 'Burst pipe', 'Low water pressure', 'Water quality concern', 'Other water fault']

function WaterFaultCard({ location, onReport }) {
  const [contactResult, setContactResult] = useState({ location: null, contact: null })
  const locationKey = `${location.municipality}|${location.province}`
  const contact = contactResult.location === locationKey ? contactResult.contact : null
  useEffect(() => {
    let active = true
    findMunicipalFaultContact(location)
      .then((next) => { if (active) setContactResult({ location: locationKey, contact: next }) })
      .catch(() => { if (active) setContactResult({ location: locationKey, contact: null }) })
    return () => { active = false }
  }, [location, locationKey])
  if (contactResult.location !== locationKey) return null
  const canDraft = Boolean(contact?.email || contact?.whatsapp)
  const phoneHref = contact?.phone ? `tel:${contact.phone.startsWith('0') ? `+27${contact.phone.slice(1)}` : `+${contact.phone}`}` : ''
  return <div className="rail-card service-card"><div className="notice-label">MUNICIPAL WATER SUPPORT</div><h3>Report a water fault</h3>{contact ? <><p>{contact.routedFrom ? `The directory lists water contacts under ${contact.name}; this report is for ${contact.routedFrom}.` : `Prepare a message for ${contact.name} with the area and exact fault location.`} Review it before sending.</p>{contact.emailScope === 'General municipal contact' && <p className="fault-unverified">No water-specific email is listed; the draft will go to the general municipal inbox.</p>}{canDraft ? <button className="fault-open-button" onClick={onReport}>Prepare fault report <span>→</span></button> : <p className="fault-unverified">This directory profile has no email or WhatsApp for a prepared report.</p>}{phoneHref && <a className="service-contact" href={phoneHref}><span>Call listed water contact</span><strong>{contact.phone}</strong></a>}<small className="service-source">Contact details can change. Please check before sending.</small></> : <><p className="fault-unverified">We don’t have a matching contact profile for this municipality yet.</p><a className="fault-open-button fault-fallback" href="https://www.gov.za/about-government/contact-directory/provincial-local-government" target="_blank" rel="noreferrer">Find official municipality contacts <span>↗</span></a></>}</div>
}

function WaterFaultReport({ location, contact, onClose, isOpen }) {
  const [faultType, setFaultType] = useState(faultTypes[0])
  const [exactLocation, setExactLocation] = useState('')
  const [landmark, setLandmark] = useState('')
  const [since, setSince] = useState('')
  const [impact, setImpact] = useState('')
  const [details, setDetails] = useState('')
  const [replyContact, setReplyContact] = useState('')
  if (!contact) return null

  const fullLocation = [exactLocation.trim(), location.area, location.municipality, location.province].filter(Boolean).join(', ')
  const message = [
    `Water fault report: ${faultType}`,
    '',
    `Area: ${location.area}, ${location.municipality}, ${location.province}`,
    `Exact location: ${fullLocation}`,
    contact.routedFrom && `The directory lists water contacts under ${contact.name}; this report concerns ${contact.routedFrom}. Please route it to the responsible water service.`,
    landmark.trim() && `Nearest landmark: ${landmark.trim()}`,
    since.trim() && `First noticed: ${since.trim()}`,
    impact.trim() && `Households affected (estimate): ${impact.trim()}`,
    details.trim() && `Details: ${details.trim()}`,
    replyContact.trim() && `Reply contact: ${replyContact.trim()}`,
    '',
    'Please log this report and share a reference number if available.',
  ].filter(Boolean).join('\n')
  const subject = `Water fault: ${faultType}: ${location.area}, ${location.municipality}`
  const email = contact.emailForFault ? contact.emailForFault(faultType) : contact.email
  const emailHref = email && `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  const whatsappNumber = contact.whatsapp.replace(/\D/g, '').replace(/^0/, '27')
  const whatsappHref = whatsappNumber && `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  const phoneDigits = contact.phone.replace(/\D/g, '')
  const dialNumber = phoneDigits.startsWith('0') ? `+27${phoneDigits.slice(1)}` : phoneDigits.startsWith('27') ? `+${phoneDigits}` : `+${phoneDigits}`
  const phoneHref = phoneDigits && `tel:${dialNumber}`
  const canSend = exactLocation.trim().length >= 3

  return <div className="fault-modal-backdrop" data-open={isOpen} aria-hidden={!isOpen} inert={!isOpen} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="fault-modal" role="dialog" aria-modal="true" aria-labelledby="fault-title"><div className="fault-modal-heading"><div><span className="eyebrow">MUNICIPAL WATER REPORT</span><h2 id="fault-title">Prepare a fault report</h2><p>{location.area} · {location.municipality}, {location.province}</p></div><button className="close-button" onClick={onClose} aria-label="Close report form">×</button></div>
    <div className="fault-form-grid"><label>What’s wrong?<select value={faultType} onChange={(event) => setFaultType(event.target.value)}>{faultTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Exact fault location <span className="required-mark">Required</span><input autoFocus required maxLength="180" value={exactLocation} onChange={(event) => setExactLocation(event.target.value)} placeholder="Street, block, or nearest address" autoComplete="street-address" /></label><label>Nearest landmark <span>Optional</span><input maxLength="120" value={landmark} onChange={(event) => setLandmark(event.target.value)} placeholder="School, shop, intersection…" /></label><label>When did it start? <span>Optional</span><input maxLength="80" value={since} onChange={(event) => setSince(event.target.value)} placeholder="e.g. This morning, around 06:00" /></label><label>Homes affected <span>Optional estimate</span><input inputMode="numeric" value={impact} onChange={(event) => setImpact(event.target.value.replace(/[^\d]/g, '').slice(0, 5))} placeholder="e.g. 12" /></label><label>Callback contact <span>Optional</span><input maxLength="120" value={replyContact} onChange={(event) => setReplyContact(event.target.value)} placeholder="Phone or email for the municipality" autoComplete="off" /></label><label className="fault-details-field">What else should the municipality know? <span>Optional</span><textarea rows="3" maxLength="500" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what you can see; don’t include account numbers or other sensitive information." /></label></div>
    <div className="fault-preview"><div><strong>Message preview</strong><span>{whatsappHref ? 'Email or WhatsApp opens a draft with these details. Calling opens your phone app; you share the details verbally.' : phoneHref ? 'Email opens a draft with these details. Calling opens your phone app; you share the details verbally.' : 'Your message opens as an email draft for you to review and send.'}</span></div><pre>{message}</pre></div>
    <div className="fault-actions"><button className="fault-cancel" onClick={onClose}>Cancel</button>{emailHref && <a className={`fault-send-button ${!canSend ? 'disabled' : ''}`} aria-disabled={!canSend} href={canSend ? emailHref : undefined} onClick={(event) => { if (!canSend) event.preventDefault() }}>Email {contact.emailScope === 'General municipal contact' ? 'general contact' : 'water contact'}</a>}{whatsappHref ? <a className={`fault-send-button whatsapp ${!canSend ? 'disabled' : ''}`} aria-disabled={!canSend} href={canSend ? whatsappHref : undefined} target="_blank" rel="noreferrer" onClick={(event) => { if (!canSend) event.preventDefault() }}>WhatsApp {contact.name}</a> : phoneHref && <a className="fault-send-button" href={phoneHref}>Call water support</a>}</div>
    {email && <p className="fault-destination">{contact.emailScope}: <strong>{email}</strong> · destination listed for {contact.name}</p>}
    <a className="fault-source-link" href={contact.source} target="_blank" rel="noreferrer">View this contact entry on Municipalities.co.za ↗</a>
  </section></div>
}

function CommunityChat({ initialLocation, onClose, dbStatus, canContribute, onRequireAccount, onLoadingChange, isOpen, usernames, currentUsername }) {
  const [room, setRoom] = useState('area')
  const [chatResult, setChatResult] = useState({ key: null, messages: [], error: '' })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const locationLabel = `${initialLocation.area}, ${initialLocation.municipality}, ${initialLocation.province}`
  const chatKey = `${room}|${initialLocation.area}|${initialLocation.municipality}|${initialLocation.province}|${dbStatus}`
  const loading = dbStatus === 'connected' && chatResult.key !== chatKey
  const messages = chatResult.key === chatKey ? chatResult.messages : []
  const error = chatResult.key === chatKey ? chatResult.error : ''

  useEffect(() => {
    if (!supabase || dbStatus !== 'connected') return undefined
    let active = true
    let channel
    const loadMessages = async () => {
      onLoadingChange?.(`load-chat-${chatKey}`, true, 'Opening your community chat…')
      try {
      let query = supabase.from('community_messages').select('id, area, municipality, province, message, display_name, created_by, created_at')
      if (room === 'area') query = query.eq('area', initialLocation.area).eq('municipality', initialLocation.municipality).eq('province', initialLocation.province)
      else if (room === 'province') query = query.eq('province', initialLocation.province)
      const { data, error: queryError } = await query.order('created_at', { ascending: false }).limit(100)
      if (queryError) throw queryError
      if (active) setChatResult({ key: chatKey, messages: (data || []).reverse(), error: '' })
      } finally {
        onLoadingChange?.(`load-chat-${chatKey}`, false)
      }
    }
    loadMessages().catch((queryError) => {
      if (active) setChatResult({ key: chatKey, messages: [], error: queryError.message || 'Could not load messages.' })
    })
    const chatTopic = `amanzi-chat-${room}-${initialLocation.province.toLowerCase().replaceAll(' ', '-')}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    channel = supabase.channel(chatTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => loadMessages().catch(() => {}))
      .subscribe()
    return () => { active = false; if (channel) supabase.removeChannel(channel) }
  }, [room, dbStatus, initialLocation.area, initialLocation.municipality, initialLocation.province, chatKey, onLoadingChange])

  async function sendMessage(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    if (containsBlockedLanguage(message)) { setChatResult((current) => ({ ...current, error: MESSAGE_LANGUAGE_ERROR })); return }
    if (supabase && !canContribute) { onRequireAccount(); setChatResult((current) => ({ ...current, error: 'Create an account and complete two-step verification to send messages.' })); return }
    if (!supabase || dbStatus !== 'connected') { setChatResult((current) => ({ ...current, error: 'Chat is unavailable until Amanzi reconnects.' })); return }
    setSending(true)
    onLoadingChange?.('send-chat-message', true, 'Sending your message…')
    try {
      const { error: insertError } = await supabase.from('community_messages').insert({ area: initialLocation.area, municipality: initialLocation.municipality, province: initialLocation.province, message, display_name: currentUsername })
      if (insertError) throw insertError
      setDraft('')
      setChatResult((current) => ({ ...current, error: '' }))
    } catch (cause) {
      const moderationError = String(cause?.message || '').includes('Amanzi does not allow')
      setChatResult((current) => ({ ...current, error: moderationError ? cause.message : 'Could not send that message. Check your connection and try again.' }))
    } finally {
      setSending(false)
      onLoadingChange?.('send-chat-message', false)
    }
  }

  return <div className="chat-backdrop" data-open={isOpen} aria-hidden={!isOpen} inert={!isOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <header className="chat-header"><div><span className="chat-eyebrow">AMANZI COMMUNITY CHAT</span><h2 id="chat-title">Talk to neighbours</h2><p>Share local observations and help each other plan.</p></div><button className="close-button" onClick={onClose} aria-label="Close chat">×</button></header>
      <div className="chat-tabs"><button className={room === 'area' ? 'active' : ''} onClick={() => setRoom('area')}>My area</button><button className={room === 'province' ? 'active' : ''} onClick={() => setRoom('province')}>{initialLocation.province}</button><button className={room === 'national' ? 'active' : ''} onClick={() => setRoom('national')}>South Africa</button></div>
      <div className="chat-safety"><span>●</span> Neighbour reports, not official notices. Don’t share your address or personal details.</div>
      <div className="chat-messages" aria-live="polite">
        {loading && <div className="chat-empty">Loading the community conversation…</div>}
        {!loading && error && messages.length === 0 && <div className="chat-empty">{error}</div>}
        {!loading && !error && messages.length === 0 && <div className="chat-empty"><strong>Start the conversation</strong><span>No messages yet. Share what you’re seeing in {room === 'area' ? initialLocation.area : room === 'province' ? initialLocation.province : 'South Africa'}.</span></div>}
        {messages.map((item) => { const author = usernames[item.created_by] || item.display_name || 'Neighbour'; return <article className="chat-message" key={item.id}><div className="chat-avatar">{author.charAt(0)}</div><div className="chat-message-body"><div className="chat-message-meta"><strong>{author}</strong>{room !== 'area' && <span>{item.area}, {item.municipality}</span>}<time>{new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div><p>{item.message}</p></div></article>})}
      </div>
      <form className="chat-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-draft">Message your neighbours</label><textarea id="chat-draft" maxLength={300} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message from ${locationLabel}…`} /><div className="chat-composer-foot"><span>{draft.length}/300 · Keep it kind and useful</span><button className="post-button small" disabled={!draft.trim() || sending}>{sending ? 'Sending…' : 'Send message'} <span>↑</span></button></div></form>
      {error && messages.length > 0 && <p className="chat-error" role="status">{error}</p>}
    </section>
  </div>
}

export default App

import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

const seed = [
  { id: 1, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'no_water', title: 'No water in parts of Phoenix', detail: 'Water has been off in our area since early this morning. Anyone else affected?', time: '8 min ago', author: 'Nandi M.', kind: 'Community update', replies: 12, confirms: 18, verified: false },
  { id: 2, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'restored', title: 'Water is back in Clayfield', detail: 'Our taps are running again. Pressure is still low on our side.', time: '21 min ago', author: 'Sihle P.', kind: 'Community update', replies: 6, confirms: 9, verified: false },
  { id: 3, area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal', title: 'Sample water interruption notice', detail: 'Demo content only. A real notice would show the municipality’s original message, affected areas and latest update time.', time: '42 min ago', author: 'Sample municipal notice', kind: 'Official notice · sample', replies: 4, confirms: 0, verified: true },
  { id: 4, area: 'Mount Edgecombe', municipality: 'eThekwini', province: 'KwaZulu-Natal', waterStatus: 'low_pressure', title: 'Pressure is lower than usual', detail: 'Not completely off, but water is only coming through slowly in our block.', time: '1 hr ago', author: 'Ayesha K.', kind: 'Community update', replies: 3, confirms: 5, verified: false },
]

const defaultLocation = { area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal' }
const locationKey = (location) => `${(location.area || '').trim().toLocaleLowerCase()}|${(location.municipality || 'eThekwini').trim().toLocaleLowerCase()}|${location.province || 'KwaZulu-Natal'}`
const locationMatches = (left, right) => locationKey(left) === locationKey(right)

function LocationSearch({ location, onChoose, disabled, inputId = 'community-location-search', label = 'Search South Africa' }) {
  const [searchText, setSearchText] = useState('')
  const [results, setResults] = useState([])
  const [resultsFor, setResultsFor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const search = searchText.trim()
    if (search.length < 3 || disabled || !supabase) return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      const { data, error: searchError } = await supabase.functions.invoke('location-search', { body: { query: search } })
      if (!active) return
      setLoading(false)
      if (searchError) {
        let message = 'Location search is unavailable right now. Please try again shortly.'
        try {
          const body = await searchError.context?.json()
          if (typeof body?.error === 'string') message = body.error
        } catch { /* Keep the generic message when the response has no readable error body. */ }
        setResults([])
        setResultsFor(search)
        setError(message)
        return
      }
      setResults(Array.isArray(data?.results) ? data.results : [])
      setResultsFor(search)
      if (data?.error) setError(data.error)
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchText, disabled])

  return <div className="location-search">
    <label htmlFor={inputId}>{label}</label>
    <div className="location-search-input"><span aria-hidden="true">⌕</span><input id={inputId} type="search" autoComplete="off" minLength={3} maxLength={80} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Try Phoenix, Mamelodi or Gqeberha" disabled={disabled} /></div>
    {disabled && <p className="location-search-hint">Connecting to Amanzi before searching…</p>}
    {!disabled && searchText.trim().length > 0 && searchText.trim().length < 3 && <p className="location-search-hint">Type at least 3 characters to search.</p>}
    {loading && searchText.trim().length >= 3 && <p className="location-search-hint" role="status">Searching neighbourhoods and towns…</p>}
    {error && resultsFor === searchText.trim() && <p className="location-search-error" role="status">{error}</p>}
    {!loading && !error && searchText.trim().length >= 3 && resultsFor === searchText.trim() && results.length === 0 && !disabled && <p className="location-search-hint">No matching neighbourhoods or towns. Try a nearby city or suburb.</p>}
    {resultsFor === searchText.trim() && results.length > 0 && <div className="location-results" role="group" aria-label="Location search results">
      {results.map((result) => <button key={`${result.area}|${result.municipality}|${result.province}`} type="button" className={`area-option location-result ${locationMatches(location, result) ? 'selected' : ''}`} aria-pressed={locationMatches(location, result)} onClick={() => { onChoose(result); setSearchText(''); setResults([]) }}>
        <span className="location-result-pin" aria-hidden="true">⌖</span><span className="area-option-copy"><strong>{result.area}</strong><small>{result.municipality}, {result.province}</small></span><span className="area-option-check" aria-hidden="true">✓</span>
      </button>)}
    </div>}
    <small className="location-attribution">Search by Geoapify · © OpenStreetMap contributors</small>
  </div>
}

function readSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem('amanzi-location'))
    if (typeof saved?.area === 'string' && saved.area.trim() && typeof saved?.municipality === 'string' && saved.municipality.trim() && provinces.includes(saved?.province)) return saved
  } catch { /* Use Phoenix when there is no saved area. */ }
  return defaultLocation
}
const waterStatuses = [
  { value: 'no_water', label: 'No water', description: 'The taps are dry', icon: '×' },
  { value: 'low_pressure', label: 'Low pressure', description: 'Water is running slowly', icon: '≈' },
  { value: 'restored', label: 'Water restored', description: 'Water is back on', icon: '✓' },
]
const waterStatusLabels = Object.fromEntries(waterStatuses.map(({ value, label }) => [value, label]))
const pulseStatuses = [...waterStatuses, { value: 'unclassified', label: 'Status not captured' }]

function App() {
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
  const [draft, setDraft] = useState('')
  const [draftArea, setDraftArea] = useState('Phoenix')
  const [draftMunicipality, setDraftMunicipality] = useState('eThekwini')
  const [draftProvince, setDraftProvince] = useState('KwaZulu-Natal')
  const [draftStatus, setDraftStatus] = useState('')
  const [notice, setNotice] = useState('')
  const [dbStatus, setDbStatus] = useState(isSupabaseConfigured ? 'connecting' : 'demo')
  const [dbMessage, setDbMessage] = useState('')
  const [chatArea, setChatArea] = useState(null)

  async function loadSharedUpdates() {
    const [{ data: updates, error: updatesError }, { data: confirmations, error: confirmationsError }] = await Promise.all([
      supabase.from('water_updates').select('id, area, municipality, province, message, water_status, display_name, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('update_confirmations').select('update_id, user_id'),
    ])
    if (updatesError) throw updatesError
    if (confirmationsError) throw confirmationsError
    const counts = new Map()
    for (const confirmation of confirmations) counts.set(confirmation.update_id, (counts.get(confirmation.update_id) || 0) + 1)
    const locations = new Map(updates.map((row) => [locationKey(row), row]))
    const chatCounts = new Map(await Promise.all([...locations.values()].map(async (updateLocation) => {
      const { count, error } = await supabase.from('community_messages').select('id', { count: 'exact', head: true })
        .eq('area', updateLocation.area).eq('municipality', updateLocation.municipality).eq('province', updateLocation.province)
      if (error) throw error
      return [locationKey(updateLocation), count || 0]
    })))
    const sharedPosts = updates.map((row) => ({
      id: row.id,
      area: row.area,
      municipality: row.municipality,
      province: row.province,
      waterStatus: row.water_status,
      createdAt: row.created_at,
      title: row.message,
      detail: `Shared by a neighbour in ${row.area}.`,
      time: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000)), 'minute'),
      author: row.display_name,
      kind: 'Community update',
      replies: chatCounts.get(locationKey(row)) || 0,
      confirms: counts.get(row.id) || 0,
      verified: false,
    }))
    setPosts(sharedPosts)
    setDbStatus('connected')
  }

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    let channel
    async function connect() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session?.user) {
        const { error: signInError } = await supabase.auth.signInAnonymously()
        if (signInError) throw signInError
      }
      if (!active) return
      await loadSharedUpdates()
      channel = supabase.channel('amanzi-water-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'water_updates' }, () => loadSharedUpdates().catch(() => {}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'update_confirmations' }, () => loadSharedUpdates().catch(() => {}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => loadSharedUpdates().catch(() => {}))
        .subscribe()
    }
    connect().catch((error) => {
      if (!active) return
      setDbStatus('error')
      setDbMessage(error.message || 'Could not connect to Amanzi data.')
    })
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const inScope = scope === 'nearby' ? locationMatches(post, location) : true
    const matches = `${post.title} ${post.detail} ${post.area}`.toLowerCase().includes(query.toLowerCase())
    return inScope && matches
  }), [posts, location, scope, query])
  const areaPosts = posts.filter((post) => locationMatches(post, location) && !post.verified)
  const areaConfirmations = areaPosts.reduce((sum, post) => sum + post.confirms, 0)
  const latestUpdate = areaPosts[0]?.time || 'No updates yet'
  const recentAreaPosts = areaPosts.filter((post) => !post.createdAt || Date.now() - new Date(post.createdAt).getTime() < 24 * 60 * 60 * 1000)
  const recentReportLabel = recentAreaPosts.length === 1 ? 'report' : 'reports'
  const statusCounts = recentAreaPosts.reduce((counts, post) => {
    if (counts[post.waterStatus] !== undefined) counts[post.waterStatus] += 1
    return counts
  }, { no_water: 0, low_pressure: 0, restored: 0, unclassified: 0 })

  function save(next) {
    setPosts(next)
    if (!supabase) localStorage.setItem('amanzi-updates', JSON.stringify(next))
  }

  async function publish(event) {
    event.preventDefault()
    if (draft.trim().length < 8 || !draftStatus || draftArea.trim().length < 2 || draftMunicipality.trim().length < 2) return
    if (supabase) {
      if (dbStatus !== 'connected') {
        setNotice('Amanzi is not connected, so this update was not shared. Refresh after Supabase is enabled.')
        return
      }
      const { error } = await supabase.from('water_updates').insert({ area: draftArea.trim(), municipality: draftMunicipality.trim(), province: draftProvince, message: draft.trim(), water_status: draftStatus, display_name: 'Neighbour' })
      if (error) {
        setNotice('Could not post right now. Please try again.')
        return
      }
      await loadSharedUpdates()
      setDraft('')
      setShowComposer(false)
      setNotice(`Your update is now shared with ${draftArea}, ${draftMunicipality}, ${draftProvince}.`)
      window.setTimeout(() => setNotice(''), 3500)
      return
    }
    const next = [{ id: Date.now(), area: draftArea.trim(), municipality: draftMunicipality.trim(), province: draftProvince, waterStatus: draftStatus, title: draft.trim().slice(0, 72), detail: 'Shared with your local Amanzi community. Add a reply if you have more context.', time: 'Just now', createdAt: new Date().toISOString(), author: 'You', kind: 'Community update', replies: 0, confirms: 0, verified: false }, ...posts]
    save(next)
    setDraft('')
    setShowComposer(false)
    setNotice(`Your update is now visible to ${draftArea}, ${draftMunicipality}, ${draftProvince}.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function confirm(id) {
    if (supabase) {
      if (dbStatus !== 'connected') {
        setNotice('Amanzi is not connected, so this confirmation was not saved.')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('update_confirmations').insert({ update_id: id, user_id: user.id })
      if (error?.code === '23505') setNotice('You’ve already confirmed this update.')
      else if (error) setNotice('Could not confirm right now. Please try again.')
      else await loadSharedUpdates()
      window.setTimeout(() => setNotice(''), 3500)
      return
    }
    save(posts.map((post) => post.id === id ? { ...post, confirms: post.confirms + 1 } : post))
  }

  function chooseLocation(nextLocation) {
    const cleanLocation = { area: nextLocation.area.trim(), municipality: nextLocation.municipality.trim(), province: nextLocation.province }
    setLocation(cleanLocation)
    try { localStorage.setItem('amanzi-location', JSON.stringify(cleanLocation)) } catch { /* Area selection still works for this session. */ }
  }

  function openComposer(target = location) {
    setDraftArea(target.area)
    setDraftMunicipality(target.municipality)
    setDraftProvince(target.province)
    setShowComposer(true)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Amanzi home"><span className="brand-mark">a</span><span>amanzi</span></a>
        <div className="top-context"><span className={`demo-tag ${dbStatus === 'connected' ? 'live-tag' : ''}`}>{dbStatus === 'connected' ? 'LIVE DATA' : dbStatus === 'error' ? 'OFFLINE' : dbStatus === 'connecting' ? 'CONNECTING' : 'DEMO DATA'}</span><span className="live-dot" /> {area} community <span className="context-divider">/</span> Water updates</div>
        <button className="avatar" aria-label="Your profile">T</button>
      </header>

      <main id="home" className="layout">
        <aside className="sidebar">
          <div className="side-label spaces-label">COMMUNITY SPACES</div>
          <button className={`nav-item ${scope === 'nearby' ? 'active' : ''}`} onClick={() => setScope('nearby')}><span className="nav-icon">◉</span><span>Near me</span><span className="nav-count">{areaPosts.length}</span></button>
          <button className={`nav-item ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}><span className="nav-icon">◎</span><span>Across South Africa</span></button>
          <div className="side-label spaces-label">QUICK LINKS</div>
          <button className="nav-item muted" onClick={() => setNotice('Official notices are labelled and shown with their source.') }><span className="nav-icon">▤</span><span>Official notices</span></button>
          <div className="sidebar-note"><div className="note-icon">✳</div><strong>Local knowledge helps.</strong><p>Share what you’re seeing so neighbours can understand what’s happening.</p></div>
          <div className="privacy-note"><span>⌑</span> Your exact address is never shown in community updates.</div>
        </aside>

        <section className="feed-column">
          <section className="community-search-panel" aria-labelledby="community-search-title">
            <div className="community-search-current"><span className="community-search-pin" aria-hidden="true">⌖</span><div><span className="community-search-overline">YOUR COMMUNITY</span><strong id="community-search-title">{area}</strong><small>{municipality}, {province}</small></div></div>
            <LocationSearch location={location} onChoose={chooseLocation} disabled={dbStatus !== 'connected'} />
          </section>
          <div className="welcome-row"><div><p className="eyebrow">{area.toUpperCase()} <span>·</span> {municipality.toUpperCase()}, {province.toUpperCase()}</p><h1>Good morning, neighbour.</h1><p className="intro">What’s happening with water around you?</p></div><button className="post-button" onClick={() => openComposer()}><span>＋</span> Share an update</button></div>

          <div className="status-card"><div className="status-symbol"><span>≈</span></div><div className="status-copy"><div className="status-title">Water picture in {area}<span className="status-pill">COMMUNITY REPORTS</span></div><p>{recentAreaPosts.length} resident {recentReportLabel} in the last 24 hours <span className="dot-sep">·</span> {areaConfirmations} confirmations overall <span className="dot-sep">·</span> Latest: {latestUpdate}</p><div className="status-breakdown">{pulseStatuses.map((status) => <span key={status.value} className={`status-count status-${status.value}`}><strong>{statusCounts[status.value]}</strong> {status.label}</span>)}</div></div></div>

          <div className="feed-toolbar"><div className="feed-tabs"><button className={scope === 'nearby' ? 'selected' : ''} onClick={() => setScope('nearby')}>My area <span>{areaPosts.length}</span></button><button className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')}>Across South Africa</button></div><label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search updates" /></label></div>

          {dbStatus === 'connecting' && <div className="toast" role="status">Connecting to Amanzi’s shared community updates…</div>}
          {dbStatus === 'error' && <div className="toast" role="status">Shared updates aren’t available: {dbMessage}. You can still explore the demo view.</div>}
          {notice && <div className="toast" role="status">✓ {notice}</div>}
          {showComposer && <form className="composer" onSubmit={publish}>
            <div className="composer-head"><div className="mini-avatar">T</div><div><strong>{scope === 'all' ? 'Share a South Africa update' : `Share with ${area}`}</strong><small>Neighbour report · don’t include your exact address.</small></div><button type="button" className="close-button" onClick={() => setShowComposer(false)} aria-label="Close">×</button></div>
            {scope === 'all' && <fieldset className="choice-group nationwide-report-location"><legend>Where is this happening?</legend><div className="report-location-current"><span>REPORT LOCATION</span><strong>{draftArea}</strong><small>{draftMunicipality}, {draftProvince}</small></div><LocationSearch location={{ area: draftArea, municipality: draftMunicipality, province: draftProvince }} onChoose={(next) => { setDraftArea(next.area); setDraftMunicipality(next.municipality); setDraftProvince(next.province) }} disabled={dbStatus !== 'connected'} inputId="report-community-search" label="Search to change the report location" /></fieldset>}
            <fieldset className="choice-group status-choice-group"><legend>What’s happening with the water?</legend><div className="status-choices">{waterStatuses.map((status) => <label className={`status-choice ${draftStatus === status.value ? `selected status-${status.value}` : ''}`} key={status.value}><input type="radio" name="water-status" value={status.value} checked={draftStatus === status.value} onChange={() => setDraftStatus(status.value)} /><span className="status-choice-icon" aria-hidden="true">{status.icon}</span><span className="status-choice-copy"><strong>{status.label}</strong><small>{status.description}</small></span><span className="choice-check" aria-hidden="true">✓</span></label>)}</div></fieldset>
            <textarea autoFocus minLength={8} maxLength={180} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add useful context, such as when it started or if it has returned…" />
            <div className="composer-foot"><span>{draft.length}/180 · {draftArea}, {draftMunicipality} · {waterStatusLabels[draftStatus] || 'Choose a status'}</span><button className="post-button small" disabled={draft.trim().length < 8 || !draftStatus || draftArea.trim().length < 2 || draftMunicipality.trim().length < 2}>Post update <span>↗</span></button></div>
          </form>}

          <div className="feed-heading"><h2>Latest from your community</h2><button className="sort-button">Most recent <span>⌄</span></button></div>
          <div className="posts-list">{visiblePosts.map((post) => <article className="post-card" key={post.id}>
            <div className="post-top"><div className={`post-type ${post.verified ? 'official' : ''}`}><span>{post.verified ? '✓' : '◉'}</span>{post.kind}{post.waterStatus && post.waterStatus !== 'unclassified' && <span className={`water-status-tag status-${post.waterStatus}`}>{waterStatusLabels[post.waterStatus]}</span>}</div><button className="more-button" aria-label="More options">···</button></div>
            <h3>{post.title}</h3><p className="post-detail">{post.detail}</p>
            {post.verified && <a className="source-link" href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">View municipal source <span>↗</span></a>}
            <div className="post-meta"><span className="mini-avatar">{post.author === 'You' ? 'T' : post.author.charAt(0)}</span><strong>{post.author}</strong><span className="meta-dot">·</span><span>{post.area}, {post.municipality}, {post.province}</span><span className="meta-dot">·</span><span>{post.time}</span></div>
            <div className="post-actions"><button onClick={() => confirm(post.id)}><span>◉</span> I’m seeing this too <b>{post.confirms}</b></button><button onClick={() => setChatArea(post)}><span>◌</span> Join area chat <b title={`${post.replies} messages in ${post.area} chat`}>{post.replies}</b></button><button className="share-action" onClick={() => navigator.clipboard?.writeText(`${post.title} — Amanzi ${post.area}, ${post.municipality}, ${post.province}`)}><span>↗</span> Share</button></div>
          </article>)}
          {visiblePosts.length === 0 && <div className="empty-state"><div>⌕</div><strong>No updates found</strong><p>Try another search or check a wider area.</p></div>}
          </div>
          <p className="demo-disclaimer">Community updates reflect what residents report. Official notices are labelled and linked to their source.</p>
        </section>

        <aside className="right-rail"><div className="rail-card area-card"><div className="rail-head"><div><span className="eyebrow">AREA PULSE · LAST 24H</span><h2>{area}</h2></div><span className="pulse-icon">⌁</span></div><p className="rail-summary">{recentAreaPosts.length ? 'Resident reports by water status. Reports describe what neighbours are experiencing.' : 'No recent status reports for this area yet.'}</p><div className="pulse-status-list">{pulseStatuses.map((status) => <div key={status.value}><span className={`pulse-status-dot status-${status.value}`} />{status.label}<strong>{statusCounts[status.value]}</strong></div>)}</div><div className="pulse-metrics"><div><strong>{areaConfirmations}</strong><span>confirmations</span></div><div><strong>{areaPosts.length}</strong><span>all time reports</span></div></div></div>
          <div className="rail-card notice-card"><div className="notice-label"><span>i</span> OFFICIAL NOTICES</div><h3>Source matters</h3><p>Amanzi community reports are not official municipal notices. We’ll label official sources clearly when a live notice feed is connected.</p><a href={province === 'KwaZulu-Natal' ? 'https://www.durban.gov.za/' : 'https://www.gov.za/about-government/contact-government'} target="_blank" rel="noreferrer">Find official services <span>↗</span></a></div>
          {municipality.toLocaleLowerCase().includes('ethekwini') && province === 'KwaZulu-Natal' && <div className="rail-card service-card"><div className="notice-label"><span>↗</span> OFFICIAL WATER SUPPORT</div><h3>Need to report a fault?</h3><p>Amanzi community updates aren’t sent to the municipality. Contact eThekwini directly:</p><a className="service-contact" href="https://wa.me/27731483477" target="_blank" rel="noreferrer"><span>WhatsApp water support</span><strong>073 148 3477</strong></a><a className="service-contact" href="tel:+27803111111"><span>Call the 24/7 line</span><strong>080 311 1111</strong></a><a className="service-email" href="mailto:eservices@durban.gov.za">Email eThekwini water services ↗</a><a className="service-source" href="https://recreation.durban.gov.za/press-statement/city-urges-residents-to-reduce-water-consumption-amid-high-demand" target="_blank" rel="noreferrer">Source: eThekwini Municipality ↗</a></div>}
        </aside>
      </main>
      {chatArea && <CommunityChat initialLocation={chatArea} onClose={() => setChatArea(null)} dbStatus={dbStatus} />}
      <footer className="footer"><span>© 2026 Amanzi</span><span>Community-powered water updates for South Africa</span><a href="#home">About Amanzi</a></footer>
    </div>
  )
}

function CommunityChat({ initialLocation, onClose, dbStatus }) {
  const [room, setRoom] = useState('area')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const locationLabel = `${initialLocation.area}, ${initialLocation.municipality}, ${initialLocation.province}`

  useEffect(() => {
    if (!supabase || dbStatus !== 'connected') { setLoading(false); return undefined }
    let active = true
    let channel
    setLoading(true)
    setMessages([])
    const loadMessages = async () => {
      let query = supabase.from('community_messages').select('id, area, municipality, province, message, display_name, created_at')
      if (room === 'area') query = query.eq('area', initialLocation.area).eq('municipality', initialLocation.municipality).eq('province', initialLocation.province)
      else if (room === 'province') query = query.eq('province', initialLocation.province)
      const { data, error: queryError } = await query.order('created_at', { ascending: false }).limit(100)
      if (queryError) throw queryError
      if (active) { setMessages((data || []).reverse()); setError(''); setLoading(false) }
    }
    loadMessages().catch((queryError) => {
      if (active) { setError(queryError.message || 'Could not load messages.'); setLoading(false) }
    })
    channel = supabase.channel(`amanzi-chat-${room}-${initialLocation.province.toLowerCase().replaceAll(' ', '-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => loadMessages().catch(() => {}))
      .subscribe()
    return () => { active = false; if (channel) supabase.removeChannel(channel) }
  }, [room, dbStatus, initialLocation.area, initialLocation.municipality, initialLocation.province])

  async function sendMessage(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    if (!supabase || dbStatus !== 'connected') { setError('Chat is unavailable until Amanzi reconnects.'); return }
    setSending(true)
    const { error: insertError } = await supabase.from('community_messages').insert({ area: initialLocation.area, municipality: initialLocation.municipality, province: initialLocation.province, message, display_name: 'Neighbour' })
    setSending(false)
    if (insertError) { setError('Could not send that message. Please try again.'); return }
    setDraft('')
  }

  return <div className="chat-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <header className="chat-header"><div><span className="chat-eyebrow">AMANZI COMMUNITY CHAT</span><h2 id="chat-title">Talk to neighbours</h2><p>Share local observations and help each other plan.</p></div><button className="close-button" onClick={onClose} aria-label="Close chat">×</button></header>
      <div className="chat-tabs"><button className={room === 'area' ? 'active' : ''} onClick={() => setRoom('area')}>My area</button><button className={room === 'province' ? 'active' : ''} onClick={() => setRoom('province')}>{initialLocation.province}</button><button className={room === 'national' ? 'active' : ''} onClick={() => setRoom('national')}>South Africa</button></div>
      <div className="chat-safety"><span>●</span> Neighbour reports, not official notices. Don’t share your address or personal details.</div>
      <div className="chat-messages" aria-live="polite">
        {loading && <div className="chat-empty">Loading the community conversation…</div>}
        {!loading && error && messages.length === 0 && <div className="chat-empty">{error}</div>}
        {!loading && !error && messages.length === 0 && <div className="chat-empty"><strong>Start the conversation</strong><span>No messages yet. Share what you’re seeing in {room === 'area' ? initialLocation.area : room === 'province' ? initialLocation.province : 'South Africa'}.</span></div>}
        {messages.map((item) => <article className="chat-message" key={item.id}><div className="chat-avatar">{item.display_name?.charAt(0) || 'N'}</div><div className="chat-message-body"><div className="chat-message-meta"><strong>{item.display_name}</strong>{room !== 'area' && <span>{item.area}, {item.municipality}</span>}<time>{new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div><p>{item.message}</p></div></article>)}
      </div>
      <form className="chat-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-draft">Message your neighbours</label><textarea id="chat-draft" maxLength={300} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message from ${locationLabel}…`} /><div className="chat-composer-foot"><span>{draft.length}/300 · Keep it kind and useful</span><button className="post-button small" disabled={!draft.trim() || sending}>{sending ? 'Sending…' : 'Send message'} <span>↑</span></button></div></form>
      {error && messages.length > 0 && <p className="chat-error" role="status">{error}</p>}
    </section>
  </div>
}

export default App

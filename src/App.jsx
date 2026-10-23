import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

const seed = [
  { id: 1, area: 'Phoenix', waterStatus: 'no_water', title: 'No water in parts of Phoenix', detail: 'Water has been off in our area since early this morning. Anyone else affected?', time: '8 min ago', author: 'Nandi M.', kind: 'Community update', replies: 12, confirms: 18, verified: false },
  { id: 2, area: 'Phoenix', waterStatus: 'restored', title: 'Water is back in Clayfield', detail: 'Our taps are running again. Pressure is still low on our side.', time: '21 min ago', author: 'Sihle P.', kind: 'Community update', replies: 6, confirms: 9, verified: false },
  { id: 3, area: 'Phoenix', title: 'Sample water interruption notice', detail: 'Demo content only. A real notice would show the municipality’s original message, affected areas and latest update time.', time: '42 min ago', author: 'Sample municipal notice', kind: 'Official notice · sample', replies: 4, confirms: 0, verified: true },
  { id: 4, area: 'Mount Edgecombe', waterStatus: 'low_pressure', title: 'Pressure is lower than usual', detail: 'Not completely off, but water is only coming through slowly in our block.', time: '1 hr ago', author: 'Ayesha K.', kind: 'Community update', replies: 3, confirms: 5, verified: false },
]

const areas = ['Phoenix', 'Mount Edgecombe', 'Verulam', 'Durban North']
const waterStatuses = [
  { value: 'no_water', label: 'No water' },
  { value: 'low_pressure', label: 'Low pressure' },
  { value: 'restored', label: 'Water restored' },
]
const waterStatusLabels = Object.fromEntries(waterStatuses.map(({ value, label }) => [value, label]))
const pulseStatuses = [...waterStatuses, { value: 'unclassified', label: 'Status not captured' }]

function App() {
  const [posts, setPosts] = useState(() => {
    if (isSupabaseConfigured) return []
    try { return JSON.parse(localStorage.getItem('amanzi-updates')) || seed } catch { return seed }
  })
  const [area, setArea] = useState('Phoenix')
  const [scope, setScope] = useState('nearby')
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftArea, setDraftArea] = useState('Phoenix')
  const [draftStatus, setDraftStatus] = useState('no_water')
  const [notice, setNotice] = useState('')
  const [dbStatus, setDbStatus] = useState(isSupabaseConfigured ? 'connecting' : 'demo')
  const [dbMessage, setDbMessage] = useState('')
  const [chatArea, setChatArea] = useState(null)

  async function loadSharedUpdates() {
    const [{ data: updates, error: updatesError }, { data: confirmations, error: confirmationsError }] = await Promise.all([
      supabase.from('water_updates').select('id, area, message, water_status, display_name, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('update_confirmations').select('update_id, user_id'),
    ])
    if (updatesError) throw updatesError
    if (confirmationsError) throw confirmationsError
    const counts = new Map()
    for (const confirmation of confirmations) counts.set(confirmation.update_id, (counts.get(confirmation.update_id) || 0) + 1)
    const chatCounts = new Map(await Promise.all([...new Set(updates.map((row) => row.area))].map(async (updateArea) => {
      const { count, error } = await supabase.from('community_messages').select('id', { count: 'exact', head: true }).eq('area', updateArea)
      if (error) throw error
      return [updateArea, count || 0]
    })))
    const sharedPosts = updates.map((row) => ({
      id: row.id,
      area: row.area,
      waterStatus: row.water_status,
      createdAt: row.created_at,
      title: row.message,
      detail: `Shared by a neighbour in ${row.area}.`,
      time: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000)), 'minute'),
      author: row.display_name,
      kind: 'Community update',
      replies: chatCounts.get(row.area) || 0,
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
    const inScope = scope === 'nearby' ? post.area === area : true
    const matches = `${post.title} ${post.detail} ${post.area}`.toLowerCase().includes(query.toLowerCase())
    return inScope && matches
  }), [posts, area, scope, query])
  const areaPosts = posts.filter((post) => post.area === area && !post.verified)
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
    if (!draft.trim()) return
    if (supabase) {
      if (dbStatus !== 'connected') {
        setNotice('Amanzi is not connected, so this update was not shared. Refresh after Supabase is enabled.')
        return
      }
      const { error } = await supabase.from('water_updates').insert({ area: draftArea, message: draft.trim(), water_status: draftStatus, display_name: 'Neighbour' })
      if (error) {
        setNotice('Could not post right now. Please try again.')
        return
      }
      await loadSharedUpdates()
      setDraft('')
      setShowComposer(false)
      setNotice(`Your update is now shared with ${draftArea}.`)
      window.setTimeout(() => setNotice(''), 3500)
      return
    }
    const next = [{ id: Date.now(), area: draftArea, waterStatus: draftStatus, title: draft.trim().slice(0, 72), detail: 'Shared with your local Amanzi community. Add a reply if you have more context.', time: 'Just now', createdAt: new Date().toISOString(), author: 'You', kind: 'Community update', replies: 0, confirms: 0, verified: false }, ...posts]
    save(next)
    setDraft('')
    setShowComposer(false)
    setNotice('Your update is now visible to your area.')
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Amanzi home"><span className="brand-mark">a</span><span>amanzi</span></a>
        <div className="top-context"><span className={`demo-tag ${dbStatus === 'connected' ? 'live-tag' : ''}`}>{dbStatus === 'connected' ? 'LIVE DATA' : dbStatus === 'error' ? 'OFFLINE' : dbStatus === 'connecting' ? 'CONNECTING' : 'DEMO DATA'}</span><span className="live-dot" /> Phoenix community <span className="context-divider">/</span> Water updates</div>
        <button className="avatar" aria-label="Your profile">T</button>
      </header>

      <main id="home" className="layout">
        <aside className="sidebar">
          <div className="side-label">YOUR AREA</div>
          <label className="select-wrap"><span className="pin-icon">⌖</span><select value={area} onChange={(e) => setArea(e.target.value)}>{areas.map((name) => <option key={name}>{name}</option>)}</select><span className="chevron">⌄</span></label>
          <div className="side-label spaces-label">COMMUNITY SPACES</div>
          <button className={`nav-item ${scope === 'nearby' ? 'active' : ''}`} onClick={() => setScope('nearby')}><span className="nav-icon">◉</span><span>Near me</span><span className="nav-count">{areaPosts.length}</span></button>
          <button className={`nav-item ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}><span className="nav-icon">◎</span><span>Greater Durban</span></button>
          <div className="side-label spaces-label">QUICK LINKS</div>
          <button className="nav-item muted" onClick={() => setNotice('Official notices are labelled and shown with their source.') }><span className="nav-icon">▤</span><span>Official notices</span></button>
          <div className="sidebar-note"><div className="note-icon">✳</div><strong>Local knowledge helps.</strong><p>Share what you’re seeing so neighbours can understand what’s happening.</p></div>
          <div className="privacy-note"><span>⌑</span> Your exact address is never shown in community updates.</div>
        </aside>

        <section className="feed-column">
          <div className="welcome-row"><div><p className="eyebrow">PHOENIX <span>·</span> DURBAN</p><h1>Good morning, neighbour.</h1><p className="intro">What’s happening with water around you?</p></div><button className="post-button" onClick={() => { setDraftArea(area); setShowComposer(true) }}><span>＋</span> Share an update</button></div>

          <div className="status-card"><div className="status-symbol"><span>≈</span></div><div className="status-copy"><div className="status-title">Water picture in {area}<span className="status-pill">COMMUNITY REPORTS</span></div><p>{recentAreaPosts.length} resident {recentReportLabel} in the last 24 hours <span className="dot-sep">·</span> {areaConfirmations} confirmations overall <span className="dot-sep">·</span> Latest: {latestUpdate}</p><div className="status-breakdown">{pulseStatuses.map((status) => <span key={status.value} className={`status-count status-${status.value}`}><strong>{statusCounts[status.value]}</strong> {status.label}</span>)}</div></div></div>

          <div className="feed-toolbar"><div className="feed-tabs"><button className={scope === 'nearby' ? 'selected' : ''} onClick={() => setScope('nearby')}>Near me <span>{areaPosts.length}</span></button><button className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')}>Across Durban</button></div><label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search updates" /></label></div>

          {dbStatus === 'connecting' && <div className="toast" role="status">Connecting to Amanzi’s shared community updates…</div>}
          {dbStatus === 'error' && <div className="toast" role="status">Shared updates aren’t available: {dbMessage}. You can still explore the demo view.</div>}
          {notice && <div className="toast" role="status">✓ {notice}</div>}
          {showComposer && <form className="composer" onSubmit={publish}><div className="composer-head"><div className="mini-avatar">T</div><div><strong>{scope === 'all' ? 'Share a Durban update' : `Share with ${area}`}</strong><small>Neighbour report · don’t include your exact address.</small></div><button type="button" className="close-button" onClick={() => setShowComposer(false)} aria-label="Close">×</button></div><div className="report-fields">{scope === 'all' && <label>Neighbourhood<select value={draftArea} onChange={(event) => setDraftArea(event.target.value)}>{areas.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}<label>Water status<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>{waterStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div><textarea autoFocus minLength={8} maxLength={180} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What are you noticing? Add useful context, not your exact address…" /><div className="composer-foot"><span>{draft.length}/180 · {draftArea} · Community report</span><button className="post-button small" disabled={draft.trim().length < 8}>Post update <span>↗</span></button></div></form>}

          <div className="feed-heading"><h2>Latest from your community</h2><button className="sort-button">Most recent <span>⌄</span></button></div>
          <div className="posts-list">{visiblePosts.map((post) => <article className="post-card" key={post.id}>
            <div className="post-top"><div className={`post-type ${post.verified ? 'official' : ''}`}><span>{post.verified ? '✓' : '◉'}</span>{post.kind}{post.waterStatus && post.waterStatus !== 'unclassified' && <span className={`water-status-tag status-${post.waterStatus}`}>{waterStatusLabels[post.waterStatus]}</span>}</div><button className="more-button" aria-label="More options">···</button></div>
            <h3>{post.title}</h3><p className="post-detail">{post.detail}</p>
            {post.verified && <a className="source-link" href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">View municipal source <span>↗</span></a>}
            <div className="post-meta"><span className="mini-avatar">{post.author === 'You' ? 'T' : post.author.charAt(0)}</span><strong>{post.author}</strong><span className="meta-dot">·</span><span>{post.area}</span><span className="meta-dot">·</span><span>{post.time}</span></div>
            <div className="post-actions"><button onClick={() => confirm(post.id)}><span>◉</span> I’m seeing this too <b>{post.confirms}</b></button><button onClick={() => setChatArea(post.area)}><span>◌</span> Join area chat <b title={`${post.replies} messages in ${post.area} chat`}>{post.replies}</b></button><button className="share-action" onClick={() => navigator.clipboard?.writeText(`${post.title} — Amanzi ${post.area}`)}><span>↗</span> Share</button></div>
          </article>)}
          {visiblePosts.length === 0 && <div className="empty-state"><div>⌕</div><strong>No updates found</strong><p>Try another search or check a wider area.</p></div>}
          </div>
          <p className="demo-disclaimer">Community updates reflect what residents report. Official notices are labelled and linked to their source.</p>
        </section>

        <aside className="right-rail"><div className="rail-card area-card"><div className="rail-head"><div><span className="eyebrow">AREA PULSE · LAST 24H</span><h2>{area}</h2></div><span className="pulse-icon">⌁</span></div><p className="rail-summary">{recentAreaPosts.length ? 'Resident reports by water status. Reports describe what neighbours are experiencing.' : 'No recent status reports for this area yet.'}</p><div className="pulse-status-list">{pulseStatuses.map((status) => <div key={status.value}><span className={`pulse-status-dot status-${status.value}`} />{status.label}<strong>{statusCounts[status.value]}</strong></div>)}</div><div className="pulse-metrics"><div><strong>{areaConfirmations}</strong><span>confirmations</span></div><div><strong>{areaPosts.length}</strong><span>all time reports</span></div></div></div>
          <div className="rail-card notice-card"><div className="notice-label"><span>i</span> OFFICIAL NOTICES</div><h3>Source matters</h3><p>Amanzi community reports are not official municipal notices. We’ll label official sources clearly when a live notice feed is connected.</p><a href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">Visit eThekwini municipality <span>↗</span></a></div>
          <div className="rail-help"><span>Need to report a fault?</span><a href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">Go to eThekwini services ↗</a><small>Amanzi community posts are not sent to the municipality.</small></div>
        </aside>
      </main>
      {chatArea && <CommunityChat initialArea={chatArea} onClose={() => setChatArea(null)} dbStatus={dbStatus} />}
      <footer className="footer"><span>© 2026 Amanzi</span><span>Community-powered water updates for South Africa</span><a href="#home">About Amanzi</a></footer>
    </div>
  )
}

function CommunityChat({ initialArea, onClose, dbStatus }) {
  const [room, setRoom] = useState(initialArea === 'Phoenix' ? 'Phoenix' : 'Greater Durban')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const areasInRoom = room === 'Phoenix' ? ['Phoenix'] : areas

  useEffect(() => {
    if (!supabase || dbStatus !== 'connected') { setLoading(false); return undefined }
    let active = true
    let channel
    setLoading(true)
    setMessages([])
    const loadMessages = async () => {
      const { data, error: queryError } = await supabase.from('community_messages')
        .select('id, area, message, display_name, created_at')
        .in('area', areasInRoom)
        .order('created_at', { ascending: false })
        .limit(100)
      if (queryError) throw queryError
      if (active) { setMessages((data || []).reverse()); setError(''); setLoading(false) }
    }
    loadMessages().catch((queryError) => {
      if (active) { setError(queryError.message || 'Could not load messages.'); setLoading(false) }
    })
    channel = supabase.channel(`amanzi-chat-${room.toLowerCase().replaceAll(' ', '-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => loadMessages().catch(() => {}))
      .subscribe()
    return () => { active = false; if (channel) supabase.removeChannel(channel) }
  }, [room, dbStatus])

  async function sendMessage(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    if (!supabase || dbStatus !== 'connected') { setError('Chat is unavailable until Amanzi reconnects.'); return }
    setSending(true)
    const { error: insertError } = await supabase.from('community_messages').insert({ area: initialArea, message, display_name: 'Neighbour' })
    setSending(false)
    if (insertError) { setError('Could not send that message. Please try again.'); return }
    setDraft('')
  }

  return <div className="chat-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <header className="chat-header"><div><span className="chat-eyebrow">AMANZI COMMUNITY CHAT</span><h2 id="chat-title">Talk to neighbours</h2><p>Share local observations and help each other plan.</p></div><button className="close-button" onClick={onClose} aria-label="Close chat">×</button></header>
      <div className="chat-tabs"><button className={room === 'Phoenix' ? 'active' : ''} onClick={() => setRoom('Phoenix')}>Phoenix</button><button className={room === 'Greater Durban' ? 'active' : ''} onClick={() => setRoom('Greater Durban')}>Greater Durban</button></div>
      <div className="chat-safety"><span>●</span> Neighbour reports, not official notices. Don’t share your address or personal details.</div>
      <div className="chat-messages" aria-live="polite">
        {loading && <div className="chat-empty">Loading the community conversation…</div>}
        {!loading && error && messages.length === 0 && <div className="chat-empty">{error}</div>}
        {!loading && !error && messages.length === 0 && <div className="chat-empty"><strong>Start the conversation</strong><span>No messages yet. Share what you’re seeing in {room === 'Phoenix' ? 'Phoenix' : 'Greater Durban'}.</span></div>}
        {messages.map((item) => <article className="chat-message" key={item.id}><div className="chat-avatar">{item.display_name?.charAt(0) || 'N'}</div><div className="chat-message-body"><div className="chat-message-meta"><strong>{item.display_name}</strong>{room === 'Greater Durban' && <span>{item.area}</span>}<time>{new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div><p>{item.message}</p></div></article>)}
      </div>
      <form className="chat-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-draft">Message your neighbours</label><textarea id="chat-draft" maxLength={300} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${initialArea} neighbours…`} /><div className="chat-composer-foot"><span>{draft.length}/300 · Keep it kind and useful</span><button className="post-button small" disabled={!draft.trim() || sending}>{sending ? 'Sending…' : 'Send message'} <span>↑</span></button></div></form>
      {error && messages.length > 0 && <p className="chat-error" role="status">{error}</p>}
    </section>
  </div>
}

export default App

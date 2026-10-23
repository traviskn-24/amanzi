import { useMemo, useState } from 'react'
import './App.css'

const seed = [
  { id: 1, area: 'Phoenix', title: 'No water in parts of Phoenix', detail: 'Low pressure since early this morning around Starwood. Anyone else affected?', time: '8 min ago', author: 'Nandi M.', kind: 'Community update', replies: 12, confirms: 18, verified: false },
  { id: 2, area: 'Phoenix', title: 'Water is back in Clayfield', detail: 'Our taps are running again. Pressure is still low on our side.', time: '21 min ago', author: 'Sihle P.', kind: 'Community update', replies: 6, confirms: 9, verified: false },
  { id: 3, area: 'Phoenix', title: 'Sample water interruption notice', detail: 'Demo content only. A real notice would show the municipality’s original message, affected areas and latest update time.', time: '42 min ago', author: 'Sample municipal notice', kind: 'Official notice · sample', replies: 4, confirms: 0, verified: true },
  { id: 4, area: 'Mount Edgecombe', title: 'Pressure is lower than usual', detail: 'Not completely off, but water is only coming through slowly in our block.', time: '1 hr ago', author: 'Ayesha K.', kind: 'Community update', replies: 3, confirms: 5, verified: false },
]

const areas = ['Phoenix', 'Mount Edgecombe', 'Verulam', 'Durban North']

function App() {
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('amanzi-updates')) || seed } catch { return seed }
  })
  const [area, setArea] = useState('Phoenix')
  const [scope, setScope] = useState('nearby')
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const inScope = scope === 'nearby' ? post.area === area : true
    const matches = `${post.title} ${post.detail} ${post.area}`.toLowerCase().includes(query.toLowerCase())
    return inScope && matches
  }), [posts, area, scope, query])

  function save(next) {
    setPosts(next)
    localStorage.setItem('amanzi-updates', JSON.stringify(next))
  }

  function publish(event) {
    event.preventDefault()
    if (!draft.trim()) return
    const next = [{ id: Date.now(), area, title: draft.trim().slice(0, 72), detail: 'Shared with your local Amanzi community. Add a reply if you have more context.', time: 'Just now', author: 'You', kind: 'Community update', replies: 0, confirms: 0, verified: false }, ...posts]
    save(next)
    setDraft('')
    setShowComposer(false)
    setNotice('Your update is now visible to your area.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  function confirm(id) {
    save(posts.map((post) => post.id === id ? { ...post, confirms: post.confirms + 1 } : post))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Amanzi home"><span className="brand-mark">a</span><span>amanzi</span></a>
        <div className="top-context"><span className="demo-tag">DEMO DATA</span><span className="live-dot" /> Phoenix community <span className="context-divider">/</span> Water updates</div>
        <button className="avatar" aria-label="Your profile">T</button>
      </header>

      <main id="home" className="layout">
        <aside className="sidebar">
          <div className="side-label">YOUR AREA</div>
          <label className="select-wrap"><span className="pin-icon">⌖</span><select value={area} onChange={(e) => setArea(e.target.value)}>{areas.map((name) => <option key={name}>{name}</option>)}</select><span className="chevron">⌄</span></label>
          <div className="side-label spaces-label">COMMUNITY SPACES</div>
          <button className={`nav-item ${scope === 'nearby' ? 'active' : ''}`} onClick={() => setScope('nearby')}><span className="nav-icon">◉</span><span>Near me</span><span className="nav-count">12</span></button>
          <button className={`nav-item ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}><span className="nav-icon">◎</span><span>Greater Durban</span></button>
          <div className="side-label spaces-label">QUICK LINKS</div>
          <button className="nav-item muted" onClick={() => setNotice('Official notices are labelled and shown with their source.') }><span className="nav-icon">▤</span><span>Official notices</span></button>
          <div className="sidebar-note"><div className="note-icon">✳</div><strong>Local knowledge helps.</strong><p>Share what you’re seeing so neighbours can understand what’s happening.</p></div>
          <div className="privacy-note"><span>⌑</span> Your exact address is never shown in community updates.</div>
        </aside>

        <section className="feed-column">
          <div className="welcome-row"><div><p className="eyebrow">FRIDAY, 23 OCTOBER <span>·</span> PHOENIX, DURBAN</p><h1>Good morning, neighbour.</h1><p className="intro">What’s happening with water around you?</p></div><button className="post-button" onClick={() => setShowComposer(true)}><span>＋</span> Share an update</button></div>

          <div className="status-card"><div className="status-symbol"><span>≈</span></div><div className="status-copy"><div className="status-title">Water updates in {area}<span className="status-pill">COMMUNITY PICTURE</span></div><p><strong>18 neighbours</strong> have confirmed an interruption nearby <span className="dot-sep">·</span> Updated 4 min ago</p></div><button className="status-arrow" aria-label="View local status">↗</button></div>

          <div className="feed-toolbar"><div className="feed-tabs"><button className={scope === 'nearby' ? 'selected' : ''} onClick={() => setScope('nearby')}>Near me <span>12</span></button><button className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')}>Across Durban</button></div><label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search updates" /></label></div>

          {notice && <div className="toast" role="status">✓ {notice}</div>}
          {showComposer && <form className="composer" onSubmit={publish}><div className="composer-head"><div className="mini-avatar">T</div><div><strong>Share with {area}</strong><small>Keep it useful. Don’t include your exact address.</small></div><button type="button" className="close-button" onClick={() => setShowComposer(false)} aria-label="Close">×</button></div><textarea autoFocus maxLength={180} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What are you noticing? e.g. No water on our street since 6am…" /><div className="composer-foot"><span>{draft.length}/180 · Community update</span><button className="post-button small" disabled={!draft.trim()}>Post update <span>↗</span></button></div></form>}

          <div className="feed-heading"><h2>Latest from your community</h2><button className="sort-button">Most recent <span>⌄</span></button></div>
          <div className="posts-list">{visiblePosts.map((post) => <article className="post-card" key={post.id}>
            <div className="post-top"><div className={`post-type ${post.verified ? 'official' : ''}`}><span>{post.verified ? '✓' : '◉'}</span>{post.kind}</div><button className="more-button" aria-label="More options">···</button></div>
            <h3>{post.title}</h3><p className="post-detail">{post.detail}</p>
            {post.verified && <a className="source-link" href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">View municipal source <span>↗</span></a>}
            <div className="post-meta"><span className="mini-avatar">{post.author === 'You' ? 'T' : post.author.charAt(0)}</span><strong>{post.author}</strong><span className="meta-dot">·</span><span>{post.area}</span><span className="meta-dot">·</span><span>{post.time}</span></div>
            <div className="post-actions"><button onClick={() => confirm(post.id)}><span>◉</span> I’m seeing this too <b>{post.confirms}</b></button><button onClick={() => setNotice('Conversation view is coming next. For now, share an update with your area.') }><span>◌</span> Join conversation <b>{post.replies}</b></button><button className="share-action" onClick={() => navigator.clipboard?.writeText(`${post.title} — Amanzi ${post.area}`)}><span>↗</span> Share</button></div>
          </article>)}
          {visiblePosts.length === 0 && <div className="empty-state"><div>⌕</div><strong>No updates found</strong><p>Try another search or check a wider area.</p></div>}
          </div>
          <p className="demo-disclaimer">Community updates reflect what residents report. Official notices are labelled and linked to their source.</p>
        </section>

        <aside className="right-rail"><div className="rail-card area-card"><div className="rail-head"><div><span className="eyebrow">AREA PULSE</span><h2>{area}</h2></div><span className="pulse-icon">⌁</span></div><p className="rail-summary">Neighbours are reporting a water interruption in parts of the area.</p><div className="pulse-metrics"><div><strong>18</strong><span>seeing an issue</span></div><div><strong>4 min</strong><span>last update</span></div></div><div className="pulse-bars"><span style={{height:'25%'}}/><span style={{height:'36%'}}/><span style={{height:'32%'}}/><span style={{height:'47%'}}/><span style={{height:'55%'}}/><span style={{height:'68%'}}/><span style={{height:'78%'}}/><span style={{height:'90%'}}/><span style={{height:'83%'}}/><span style={{height:'100%'}}/><span style={{height:'95%'}}/><span style={{height:'88%'}}/><span style={{height:'76%'}}/><span style={{height:'69%'}}/><span style={{height:'60%'}}/><span style={{height:'54%'}}/><span style={{height:'43%'}}/><span style={{height:'34%'}}/><span style={{height:'26%'}}/><span style={{height:'19%'}}/></div><div className="chart-labels"><span>6 AM</span><span>NOW</span></div><p className="chart-caption">Neighbour confirmations over the last 2 hours</p></div>
          <div className="rail-card notice-card"><div className="notice-label"><span>✓</span> SAMPLE OFFICIAL NOTICE</div><h3>Water supply update</h3><p>Demo content only. A live version should link to the original notice and clearly show when it was published.</p><a href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">Municipality website <span>↗</span></a><div className="notice-time">Sample · not a live notice</div></div>
          <div className="rail-help"><span>Need to report a fault?</span><a href="https://www.durban.gov.za/" target="_blank" rel="noreferrer">Go to eThekwini services ↗</a><small>Amanzi community posts are not sent to the municipality.</small></div>
        </aside>
      </main>
      <footer className="footer"><span>© 2026 Amanzi</span><span>Community-powered water updates for South Africa</span><a href="#home">About Amanzi</a></footer>
    </div>
  )
}

export default App

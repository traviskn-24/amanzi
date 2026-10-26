import { useCallback, useEffect, useMemo, useState } from 'react'
import './official-notices.css'

const noticeStatuses = {
  active: 'Active notice',
  updated: 'Updated by publisher',
  cleared: 'Publisher marked cleared',
  needs_recheck: 'Needs rechecking',
}

function isRecentEnough(notice) {
  const checked = new Date(notice.last_checked_at || notice.updated_at).getTime()
  return Number.isFinite(checked) && Date.now() - checked > 48 * 60 * 60 * 1000
}

export default function OfficialNoticesPanel({ supabase, user, location }) {
  const [notices, setNotices] = useState([])
  const [publisher, setPublisher] = useState(null)
  const [emailPreference, setEmailPreference] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [formMode, setFormMode] = useState('new')
  const [selectedNotice, setSelectedNotice] = useState('')
  const [form, setForm] = useState({ title: '', summary: '', sourceUrl: '', sourcePublishedAt: '', status: 'active' })

  const loadNotices = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('official_notices')
      .select('id, authority_name, publisher_label, title, summary, source_url, source_published_at, last_checked_at, status, is_demo, published_by, published_at, revision, official_notice_areas(area, municipality, province)')
      .neq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(60)
    if (error) {
      setMessage('Official notices are temporarily unavailable. Community reports remain separate and are not official notices.')
      return
    }
    setNotices(data || [])
  }, [supabase])

  useEffect(() => { void loadNotices() }, [loadNotices])

  useEffect(() => {
    let alive = true
    if (!supabase || !user || user.is_anonymous) {
      setPublisher(null)
      setEmailPreference(null)
      return () => { alive = false }
    }
    supabase.from('notice_publishers').select('publisher_label, organization_name, role, active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setPublisher(data?.active ? data : null) })
    supabase.functions.invoke('manage-official-notice-email', { body: { action: 'status' } })
      .then(({ data, error }) => { if (alive) setEmailPreference(error ? { configured: false, enabled: false, email: user.email } : data) })
    return () => { alive = false }
  }, [supabase, user])

  const relevantNotices = useMemo(() => notices.filter((notice) => {
    const targets = notice.official_notice_areas || []
    return targets.some((target) =>
      target.province === location.province && target.municipality === location.municipality &&
      (target.area.toLocaleLowerCase() === location.area.toLocaleLowerCase() || target.area === 'All areas')
    )
  }), [notices, location.area, location.municipality, location.province])

  const ownNotices = useMemo(() => relevantNotices.filter((notice) => notice.published_by === user?.id && notice.is_demo === (publisher?.role === 'demo')), [relevantNotices, user?.id, publisher?.role])

  async function changeEmailSubscription(enabled) {
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.functions.invoke('manage-official-notice-email', { body: { action: 'set', enabled } })
    setBusy(false)
    if (error || data?.error) {
      setMessage(data?.error || 'Could not update your email preference. Confirm your email address and try again.')
      return
    }
    setEmailPreference(data)
    setMessage(enabled ? `Official notices will be sent to ${data.email}.` : 'Official notice emails are turned off.')
  }

  async function saveNotice(event) {
    event.preventDefault()
    if (!publisher?.active) return
    setBusy(true)
    setMessage('')
    const sourcePublishedAt = form.sourcePublishedAt ? new Date(form.sourcePublishedAt).toISOString() : null
    let result
    if (formMode === 'new') {
      result = await supabase.rpc('publish_official_notice', {
        p_title: form.title,
        p_summary: form.summary,
        p_source_url: form.sourceUrl,
        p_source_published_at: sourcePublishedAt,
        p_area: location.area,
        p_municipality: location.municipality,
        p_province: location.province,
      })
    } else {
      result = await supabase.rpc('update_official_notice', {
        p_notice_id: selectedNotice,
        p_status: form.status,
        p_summary: form.summary,
        p_source_url: form.sourceUrl,
        p_source_published_at: sourcePublishedAt,
      })
    }
    if (result.error) {
      setBusy(false)
      setMessage(result.error.message || 'The notice could not be saved.')
      return
    }
    const payload = result.data || {}
    let deliveryCopy = ''
    if (!payload.is_demo && publisher.role === 'authority') {
      const { data: delivery, error: deliveryError } = await supabase.functions.invoke('dispatch-official-notice-email', { body: { noticeId: payload.id || selectedNotice } })
      if (deliveryError || delivery?.error) deliveryCopy = ' The notice is visible in Amanzi, but email delivery could not be completed.'
      else deliveryCopy = ` Email sent to ${delivery.delivered || 0} subscribed account${delivery.delivered === 1 ? '' : 's'} in the affected area.`
    } else {
      deliveryCopy = ' This is a clearly marked demo notice and does not send emails or represent a live authority warning.'
    }
    setForm({ title: '', summary: '', sourceUrl: '', sourcePublishedAt: '', status: 'active' })
    setFormMode('new')
    setSelectedNotice('')
    await loadNotices()
    setBusy(false)
    setMessage(`Notice saved.${deliveryCopy}`)
  }

  return <section className="official-notices-panel" aria-labelledby="official-notices-heading">
    <div className="official-notices-header">
      <div>
        <span className="official-notices-kicker">SOURCE-LINKED INFORMATION</span>
        <h2 id="official-notices-heading">Official notices</h2>
        <p>Authority notices are published by approved accounts and linked to their source. Resident reports stay labelled as community reports.</p>
      </div>
      <span className="official-notices-location">{location.area}</span>
    </div>

    <div className="official-notice-list">
      {relevantNotices.map((notice) => {
        const targets = notice.official_notice_areas || []
        const ageNeedsCheck = !notice.is_demo && notice.status !== 'cleared' && isRecentEnough(notice)
        return <article className={`official-notice-card ${notice.is_demo ? 'is-demo' : ''}`} key={notice.id}>
          <div className="official-notice-topline">
            <span className={`official-notice-status status-${notice.status}`}>{noticeStatuses[notice.status] || 'Notice'}</span>
            {notice.is_demo && <span className="official-notice-demo-label">DEMO · NOT A LIVE WARNING</span>}
            {ageNeedsCheck && <span className="official-notice-stale">Check the original source</span>}
          </div>
          <h3>{notice.title}</h3>
          <p>{notice.summary}</p>
          <div className="official-notice-meta"><strong>{notice.authority_name}</strong><span>Published by {notice.publisher_label}</span><span>{targets.map((target) => target.area).join(', ')}</span></div>
          <div className="official-notice-footer">
            <a href={notice.source_url} target="_blank" rel="noreferrer">Open original source <span aria-hidden="true">↗</span></a>
            <time dateTime={notice.last_checked_at}>Source checked {new Date(notice.last_checked_at).toLocaleDateString('en-ZA')}</time>
          </div>
          {publisher?.active && notice.published_by === user?.id && notice.is_demo === (publisher.role === 'demo') && <button className="official-notice-edit" type="button" onClick={() => { setFormMode('update'); setSelectedNotice(notice.id); setForm({ title: notice.title, summary: notice.summary, sourceUrl: notice.source_url, sourcePublishedAt: notice.source_published_at ? new Date(notice.source_published_at).toISOString().slice(0, 16) : '', status: notice.status === 'active' ? 'updated' : notice.status }) }}>Update this notice</button>}
        </article>
      })}
      {relevantNotices.length === 0 && <p className="official-notice-empty">No source-linked official notices for {location.area} right now. Community reports may still appear in the feed below.</p>}
    </div>

    <div className="official-notice-subscribe">
      <div><strong>Get official notices by email</strong><p>{user?.email ? <>We send to your confirmed Amanzi account address: <b>{user.email}</b>. Only approved authority notices for your saved areas are emailed.</> : 'Sign in and confirm your email to choose an address for notice emails.'}</p></div>
      {!user || user.is_anonymous ? <span className="official-notice-unavailable">Sign in to subscribe</span> : emailPreference?.enabled
        ? <button type="button" disabled={busy} onClick={() => void changeEmailSubscription(false)}>Turn off emails</button>
        : <button type="button" disabled={busy || !emailPreference?.configured} title={!emailPreference?.configured ? 'Email delivery is waiting for a verified Amanzi sender to be configured.' : undefined} onClick={() => void changeEmailSubscription(true)}>{emailPreference?.configured ? 'Subscribe' : 'Email setup pending'}</button>}
    </div>
    {!emailPreference?.configured && user && !user.is_anonymous && <p className="official-notice-setup-note">Email delivery is not active yet. Amanzi will send to your confirmed account email after the verified sender is configured.</p>}

    {publisher?.active && <details className="official-notice-publisher">
      <summary><span>{publisher.role === 'demo' ? 'Judge demo publisher tools' : 'Approved publisher tools'}</span><small>{publisher.organization_name}</small></summary>
      <div className="official-notice-publisher-body">
        <p>{publisher.role === 'demo' ? 'Judge accounts can create sample notices for demonstration. These are always labelled as demo content, are not official warnings and never trigger email.' : 'Publish only notices that you have verified on the issuing authority’s official source. Add the source link and return to update or clear the notice as information changes.'}</p>
        {ownNotices.length > 0 && <label className="official-notice-field">Update an existing notice<select value={formMode === 'update' ? selectedNotice : ''} onChange={(event) => { const item = ownNotices.find((notice) => notice.id === event.target.value); if (!item) { setFormMode('new'); setSelectedNotice(''); setForm({ title: '', summary: '', sourceUrl: '', sourcePublishedAt: '', status: 'active' }); return } setFormMode('update'); setSelectedNotice(item.id); setForm({ title: item.title, summary: item.summary, sourceUrl: item.source_url, sourcePublishedAt: item.source_published_at ? new Date(item.source_published_at).toISOString().slice(0, 16) : '', status: 'updated' }) }}><option value="">Publish a new notice</option>{ownNotices.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}
        <form onSubmit={saveNotice}>
          {formMode === 'new' && <label className="official-notice-field">Notice title<input required minLength={6} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="For example, Water safety advisory for Phoenix" /></label>}
          <label className="official-notice-field">Source-linked summary<textarea required minLength={20} maxLength={1500} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Summarise what the official source says. Keep the meaning accurate." /></label>
          <label className="official-notice-field">Official source URL<input required type="url" pattern="https://.*" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://..." /></label>
          <label className="official-notice-field">Source publication time <span className="optional-label">Optional</span><input type="datetime-local" value={form.sourcePublishedAt} onChange={(event) => setForm({ ...form, sourcePublishedAt: event.target.value })} /></label>
          {formMode === 'update' && <label className="official-notice-field">Notice status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="updated">Updated</option><option value="active">Still active</option><option value="cleared">Cleared by publisher</option><option value="needs_recheck">Needs rechecking</option></select></label>}
          <div className="official-notice-review-note">{publisher.role === 'demo' ? 'This will be labelled DEMO and visible for demonstration only. It will not be sent by email.' : <>This publishes as an authority notice linked to <b>{publisher.organization_name}</b>, for {location.area}, {location.municipality}. The notice is not an automated municipal feed.</>}</div>
          <button className="official-notice-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : formMode === 'new' ? 'Publish notice' : 'Save notice update'}</button>
        </form>
      </div>
    </details>}
    {message && <p className="official-notice-feedback" role="status">{message}</p>}
    <p className="official-notice-disclaimer">Amanzi displays source-linked notices but does not verify the issuing authority’s live systems. A community post is not an official warning, and contacting a provider through Amanzi does not confirm that the provider received a report.</p>
  </section>
}

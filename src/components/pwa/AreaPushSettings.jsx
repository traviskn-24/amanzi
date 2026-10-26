import { useEffect, useState } from 'react'

function decodeVapidKey(value) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0))
}

export default function AreaPushSettings({ supabase, enabled, areaCount }) {
  const [supported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [alertOutages, setAlertOutages] = useState(true)
  const [alertRestorations, setAlertRestorations] = useState(true)
  const [alertOfficialNotices, setAlertOfficialNotices] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supported || !areaCount) return
    let cancelled = false
    async function load() {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (cancelled) return
        setActive(Boolean(subscription))
        if (subscription) {
          const { data, error } = await supabase.functions.invoke('manage-push-subscriptions', {
            body: { action: 'status', endpoint: subscription.endpoint },
          })
          if (!error && data) {
            setActive(Boolean(data.subscription))
            if (data.subscription) {
              setAlertOutages(data.subscription.alertOutages)
              setAlertRestorations(data.subscription.alertRestorations)
              setAlertOfficialNotices(data.subscription.alertOfficialNotices ?? false)
            } else {
              await subscription.unsubscribe()
              setActive(false)
            }
          }
        }
      } catch {
        if (!cancelled) setMessage('Could not check this device’s notification settings.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, areaCount, supported])

  async function saveSubscription(subscription, preferences = {}) {
    const json = subscription.toJSON()
    const { error } = await supabase.functions.invoke('manage-push-subscriptions', {
      body: {
        action: 'subscribe',
        endpoint: json.endpoint,
        keys: json.keys,
        alertOutages: preferences.alertOutages ?? alertOutages,
        alertRestorations: preferences.alertRestorations ?? alertRestorations,
        alertOfficialNotices: preferences.alertOfficialNotices ?? alertOfficialNotices,
      },
    })
    if (error) throw error
  }

  async function enable() {
    if (busy || !supported || !areaCount) return
    setBusy(true)
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage(permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Allow notifications to receive important updates.')
        return
      }
      const { data: config, error: configError } = await supabase.functions.invoke('manage-push-subscriptions', { body: { action: 'config' } })
      if (configError || !config?.publicKey) throw configError || new Error('Push is still being configured.')
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(config.publicKey) })
      await saveSubscription(subscription)
      setActive(true)
      setMessage('This device will receive the alerts you select for saved areas.')
    } catch (error) {
      setMessage(error?.message || 'Could not enable notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const { error } = await supabase.functions.invoke('manage-push-subscriptions', { body: { action: 'unsubscribe', endpoint: subscription.endpoint } })
        if (error) throw error
        await subscription.unsubscribe()
      }
      setActive(false)
      setMessage('Notifications are off on this device.')
    } catch {
      setMessage('Could not update this device. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function updatePreference(key, value) {
    const next = { alertOutages, alertRestorations, alertOfficialNotices, [key]: value }
    setAlertOutages(next.alertOutages)
    setAlertRestorations(next.alertRestorations)
    setAlertOfficialNotices(next.alertOfficialNotices)
    if (!active) return
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) throw new Error('This device is no longer subscribed. Turn notifications on again.')
      await saveSubscription(subscription, next)
      setMessage('Notification preferences saved.')
    } catch (error) {
      setMessage(error?.message || 'Could not save notification preferences.')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled || !areaCount) return null
  return <div className="area-push-settings" aria-labelledby="area-push-title">
    <div className="area-push-heading"><div><strong id="area-push-title">Important area alerts</strong><span>Only for saved areas, on this device</span></div>
      {!supported ? <span className="area-push-unsupported">Not supported here</span> : active
        ? <button type="button" className="area-push-toggle active" onClick={disable} disabled={busy}>{busy ? 'Updating…' : 'Turn off'}</button>
        : <button type="button" className="area-push-toggle" onClick={enable} disabled={busy}>{busy ? 'Setting up…' : 'Turn on'}</button>}
    </div>
    {supported && <div className="area-push-preferences">
      <label><input type="checkbox" checked={alertOutages} disabled={!active || busy} onChange={(event) => updatePreference('alertOutages', event.target.checked)} /> Outages, low pressure and water concerns</label>
      <label><input type="checkbox" checked={alertRestorations} disabled={!active || busy} onChange={(event) => updatePreference('alertRestorations', event.target.checked)} /> Water restored</label>
      <label><input type="checkbox" checked={alertOfficialNotices} disabled={!active || busy} onChange={(event) => updatePreference('alertOfficialNotices', event.target.checked)} /> Official notices</label>
    </div>}
    {message && <p className="area-push-message" role="status">{message}</p>}
    {active && !message && <p className="area-push-message">Community alerts need two independent neighbour confirmations. Safety observations are not water tests or official guidance. Official notices come from approved publishers and include a source link.</p>}
  </div>
}

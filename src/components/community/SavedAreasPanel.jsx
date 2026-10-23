import { useEffect, useRef, useState } from 'react'
import { locationMatches, maxSavedAreas } from '../../lib/locations'
import LocationSearch from './LocationSearch'
import AreaPushSettings from '../pwa/AreaPushSettings'

export default function SavedAreasPanel({ supabase, location, areas, loading, busy, message, canManage, signedIn, searchDisabled, onSave, onSelect, onRemove, onSetDefault, onRequireAccount }) {
  const [addingArea, setAddingArea] = useState(false)
  const [renderAddingArea, setRenderAddingArea] = useState(false)
  const [areaToAdd, setAreaToAdd] = useState(null)
  const closeTimer = useRef(null)
  const limitReached = areas.length >= maxSavedAreas

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  function openAddForm() {
    window.clearTimeout(closeTimer.current)
    setRenderAddingArea(true)
    setAddingArea(true)
    setAreaToAdd(null)
  }

  function closeAddForm() {
    setAddingArea(false)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setRenderAddingArea(false)
      setAreaToAdd(null)
    }, 180)
  }

  async function saveSelectedArea() {
    if (!areaToAdd || busy || loading) return
    if (await onSave(areaToAdd)) {
      closeAddForm()
    }
  }

  return <section className="saved-areas" aria-labelledby="saved-areas-title">
    <div className="saved-areas-heading">
      <div><span className="eyebrow">YOUR AREAS</span><h2 id="saved-areas-title">Follow the places you care about</h2></div>
      <span className="saved-areas-count" aria-label={`${areas.length} of ${maxSavedAreas} areas saved`}>{areas.length}/{maxSavedAreas}</span>
    </div>
    {canManage ? <>
      <p className="saved-areas-copy">Add up to three areas to follow them across devices.</p>
      {loading ? <p className="saved-areas-status" role="status">Loading your saved areas…</p> : areas.length > 0 && <div className="saved-areas-list" role="group" aria-label="Saved community areas">
        {areas.map((savedArea) => <div className={`saved-area-row ${locationMatches(savedArea, location) ? 'active' : ''}`} key={savedArea.slot}>
          <button type="button" className="saved-area-select" aria-pressed={locationMatches(savedArea, location)} onClick={() => onSelect(savedArea)}>
            <span className="saved-area-name">{savedArea.area}{savedArea.is_default ? <span className="saved-area-default-tag">Default</span> : null}</span><span className="saved-area-place">{savedArea.municipality}, {savedArea.province}</span>
          </button>
          {!savedArea.is_default && <button type="button" className="saved-area-set-default" onClick={() => onSetDefault(savedArea)} disabled={busy}>Set default</button>}
          <button type="button" className="saved-area-remove" onClick={() => onRemove(savedArea)} aria-label={`Remove ${savedArea.area} from saved areas`} disabled={busy}>Remove</button>
        </div>)}
      </div>}
      {message && <p className="saved-areas-status" role="status">{message}</p>}
      {!limitReached && !addingArea && !renderAddingArea && <button type="button" className="saved-area-add" onClick={openAddForm} disabled={busy || loading}>Add another area</button>}
      {renderAddingArea && <div className="saved-area-add-form" data-open={addingArea} inert={!addingArea}>
        <LocationSearch location={location} onChoose={setAreaToAdd} disabled={searchDisabled || busy || loading} inputId="saved-area-search" label="Search for an area to add" placeholder="Phoenix or Mamelodi" />
        {areaToAdd && <div className="saved-area-pending"><strong>{areaToAdd.area}</strong><span>{areaToAdd.municipality}, {areaToAdd.province}</span></div>}
        {areaToAdd && areas.some((savedArea) => locationMatches(savedArea, areaToAdd)) && <p className="saved-area-duplicate" role="status">This area is already saved.</p>}
        <div className="saved-area-add-actions"><button type="button" className="saved-area-add" onClick={saveSelectedArea} disabled={!areaToAdd || busy || loading || areas.some((savedArea) => areaToAdd && locationMatches(savedArea, areaToAdd))}>{busy ? 'Saving…' : 'Add to my areas'}</button><button type="button" className="saved-area-cancel" onClick={closeAddForm} disabled={busy}>Cancel</button></div>
      </div>}
      {limitReached && <small className="saved-areas-hint">You’ve saved all three areas. Remove one to add another.</small>}
      <AreaPushSettings supabase={supabase} enabled={canManage} areaCount={areas.length} />
    </> : <div className="saved-areas-guest">
      <p>{signedIn ? 'Complete two-step verification to manage saved areas.' : 'Sign in and verify with an authenticator to save up to three areas across devices.'}</p>
      <button type="button" className="saved-area-add" onClick={onRequireAccount}>{signedIn ? 'Continue account security' : 'Sign in to save areas'}</button>
    </div>}
  </section>
}

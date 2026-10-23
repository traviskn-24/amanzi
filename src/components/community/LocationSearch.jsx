import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { locationMatches } from '../../lib/locations'

export default function LocationSearch({ location, onChoose, disabled, inputId = 'community-location-search', label = 'Search South Africa', placeholder = 'Try Phoenix, Mamelodi or Gqeberha' }) {
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
      try {
        const { data, error: searchError } = await supabase.functions.invoke('location-search', { body: { query: search } })
        if (!active) return
        if (searchError) throw searchError
        setResults(Array.isArray(data?.results) ? data.results : [])
        setResultsFor(search)
        if (data?.error) setError(data.error)
      } catch {
        if (active) {
          setResults([])
          setResultsFor(search)
          setError('Location search is unavailable right now. Please try again shortly.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchText, disabled])

  return <div className="location-search">
    <label htmlFor={inputId}>{label}</label>
    <div className="location-search-input uiverse-input-shell"><span aria-hidden="true">⌕</span><input id={inputId} type="search" autoComplete="off" minLength={3} maxLength={80} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={placeholder} disabled={disabled} /></div>
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

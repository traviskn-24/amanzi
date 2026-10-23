const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

const provinceByCode: Record<string, string> = {
  EC: 'Eastern Cape',
  FS: 'Free State',
  GT: 'Gauteng',
  KZN: 'KwaZulu-Natal',
  LP: 'Limpopo',
  MP: 'Mpumalanga',
  NC: 'Northern Cape',
  NW: 'North West',
  WC: 'Western Cape',
}
const provinceNames = new Set(Object.values(provinceByCode))
const allowedResultTypes = new Set(['suburb', 'district', 'city', 'county'])
const requestTimes = new Map<string, number[]>()
const maxTrackedUsers = 5000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getUserId(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).sub as string | undefined
  } catch {
    return null
  }
}

function withinRateLimit(userId: string) {
  const now = Date.now()
  const recent = (requestTimes.get(userId) || []).filter((time) => now - time < 60_000)
  if (recent.length >= 20) return false
  recent.push(now)
  if (!requestTimes.has(userId) && requestTimes.size >= maxTrackedUsers) {
    const oldestUser = requestTimes.keys().next().value
    if (oldestUser) requestTimes.delete(oldestUser)
  }
  requestTimes.set(userId, recent)
  return true
}

async function findMunicipality(lon: number, lat: number) {
  const endpoint = new URL('https://gislive21.ndmc.gov.za/hosting/rest/services/SouthAfricaBoundaries/MapServer/2/query')
  endpoint.searchParams.set('geometry', JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }))
  endpoint.searchParams.set('geometryType', 'esriGeometryPoint')
  endpoint.searchParams.set('inSR', '4326')
  endpoint.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  endpoint.searchParams.set('outFields', 'MUNICNAME,PROVNAME,PROVINCE')
  endpoint.searchParams.set('returnGeometry', 'false')
  endpoint.searchParams.set('f', 'json')

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(7000) })
  if (!response.ok) return null
  const data = await response.json()
  const attributes = data?.features?.[0]?.attributes
  const municipality = typeof attributes?.MUNICNAME === 'string' ? attributes.MUNICNAME.trim() : ''
  const provinceFromName = typeof attributes?.PROVNAME === 'string' ? attributes.PROVNAME.trim() : ''
  const provinceCode = typeof attributes?.PROVINCE === 'string' ? attributes.PROVINCE.trim().toUpperCase() : ''
  const province = provinceNames.has(provinceFromName) ? provinceFromName : provinceByCode[provinceCode]
  return municipality && province ? { municipality, province } : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const userId = getUserId(req.headers.get('Authorization'))
  if (!userId) return json({ error: 'Sign in to search for a community.' }, 401)
  if (!withinRateLimit(userId)) return json({ error: 'Please wait a moment before searching again.' }, 429)

  const apiKey = Deno.env.get('GEOAPIFY_API_KEY')
  if (!apiKey) return json({ error: 'Location search is not configured yet.' }, 503)

  let query: string
  try {
    const body = await req.json()
    query = typeof body?.query === 'string' ? body.query.trim() : ''
  } catch {
    return json({ error: 'Enter a neighbourhood or town to search.' }, 400)
  }
  if (query.length < 3 || query.length > 80) return json({ error: 'Search must be between 3 and 80 characters.' }, 400)

  try {
    const endpoint = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
    endpoint.searchParams.set('text', query)
    endpoint.searchParams.set('type', 'locality')
    endpoint.searchParams.set('filter', 'countrycode:za')
    endpoint.searchParams.set('lang', 'en')
    endpoint.searchParams.set('limit', '8')
    endpoint.searchParams.set('format', 'json')
    endpoint.searchParams.set('apiKey', apiKey)
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(7000) })
    if (!response.ok) return json({ error: 'Location search is temporarily unavailable.' }, 502)
    const data = await response.json()
    const candidates = (Array.isArray(data?.results) ? data.results : [])
      .filter((place: any) => place?.country_code === 'za' && allowedResultTypes.has(place?.result_type))
      .filter((place: any) => typeof place?.lat === 'number' && typeof place?.lon === 'number')
      .slice(0, 8)

    const checked = await Promise.all(candidates.map(async (place: any) => {
      try {
        const boundary = await findMunicipality(place.lon, place.lat)
        if (!boundary) return null
        const area = [place.suburb, place.district, place.city, place.county, place.name]
          .find((value) => typeof value === 'string' && value.trim())?.trim()
        if (!area) return null
        return { area, ...boundary }
      } catch {
        return null
      }
    }))
    const unique = new Map<string, { area: string; municipality: string; province: string }>()
    for (const result of checked) {
      if (!result) continue
      const key = `${result.area.toLocaleLowerCase()}|${result.municipality.toLocaleLowerCase()}|${result.province}`
      unique.set(key, result)
    }
    return json({ results: [...unique.values()].slice(0, 5) })
  } catch {
    return json({ error: 'Location search is temporarily unavailable.' }, 502)
  }
})

const PRODUCTION_APP_ORIGIN = 'https://amanzi-sooty.vercel.app'

function getAppOrigin() {
  const configuredOrigin = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '')

  const { hostname, origin } = window.location
  // Emails opened on another device cannot return to the developer's localhost.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return PRODUCTION_APP_ORIGIN
  return origin
}

export function authRedirectUrl(path = '/') {
  return new URL(path, `${getAppOrigin()}/`).toString()
}

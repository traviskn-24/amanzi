const CACHE_PREFIX = 'amanzi-app-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v2`
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/brand/amanzi-logo.png',
  '/icons/amanzi-192.png',
  '/icons/amanzi-512.png',
  '/media/amanzi-loader.mp4',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put('/index.html', response.clone())
      }
      return response
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME)
      return (await cache.match('/index.html')) || Response.error()
    }))
    return
  }

  if (/\.(?:js|css|svg|png|ico|woff2?|mp4)$/i.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then(async (response) => {
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, response.clone())
        }
        return response
      })
    }))
  }
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = { body: event.data?.text() || '' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Amanzi area update'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'There is a new update in one of your saved areas.',
    icon: '/icons/amanzi-192.png',
    badge: '/icons/amanzi-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    renotify: false,
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  const safePath = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(safePath)
        return client.focus()
      }
    }
    return self.clients.openWindow(safePath)
  }))
})

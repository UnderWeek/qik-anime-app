// QIK Anime — service worker
// Cache strategy: network-first for pages, cache-first for static assets.

const CACHE_STATIC = 'qik-static-v1'
const CACHE_PAGES = 'qik-pages-v1'

const STATIC_EXTS = /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2|woff|ttf|json|xml|txt)$/i

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES).map((k) => caches.delete(k))
      )
    })
  )
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Don't cache API calls or socket.io
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return
  }

  // Static assets: cache-first
  if (STATIC_EXTS.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          })
          return cached || fetchPromise
        })
      })
    )
    return
  }

  // Pages: network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const cloned = response.clone()
          caches.open(CACHE_PAGES).then((cache) => cache.put(event.request, cloned))
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})

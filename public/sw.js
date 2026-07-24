// Realms Field service worker: network-first so new deployments always apply.
const CACHE = 'realms-v2'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // don't touch Supabase, tiles, APIs
  // Network-first: fetch the latest, update the cache, fall back to cache only when offline.
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)) }
      return res
    }).catch(() => caches.open(CACHE).then(c => c.match(req).then(m => m || (req.mode === 'navigate' ? c.match('/') : undefined))))
  )
})

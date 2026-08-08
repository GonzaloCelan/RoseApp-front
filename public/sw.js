const CACHE_NAME = 'rose-showroom-v3'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/rose-black-192.png',
  '/icons/rose-black-512.png',
  '/icons/rose-black-maskable.png',
  '/icons/rose-black-192.svg',
  '/icons/rose-black-512.svg',
  '/icons/rose-black-maskable.svg',
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
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      if (response.ok && ['document', 'script', 'style', 'image', 'font'].includes(request.destination)) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, response.clone())
      }
      return response
    } catch {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) return cachedResponse
      if (request.mode === 'navigate') return caches.match('/index.html')
      return new Response('Sin conexión', { status: 503, statusText: 'Offline' })
    }
  })())
})

const CACHE = 'parchita-v1';
const STATIC = [
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // App shell → cache-first
  if (STATIC.includes(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(res => res || fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; }))
      )
    );
    return;
  }

  // CDN resources → network-first, fallback to cache
  if (url.hostname.includes('cdn')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else → network-only
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

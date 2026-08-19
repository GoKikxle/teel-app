// Adapted from the prototype's hand-rolled service worker for a Vite build.
// Vite fingerprints JS/CSS bundle filenames at build time, so we can't
// hardcode a precache list the way the static prototype did. Instead: precache
// the known-stable shell (root document, manifest, icons), and runtime-cache
// everything else as it's fetched — so a second offline visit still has the
// hashed bundle from the first online visit.
const CACHE = 'teel-shell-v1';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // don't cache cross-origin (Supabase) calls

  // SPA navigations: network-first so routing/data stays fresh, falling back
  // to the cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // Everything else (bundled JS/CSS, icons): cache-first, populate on miss.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

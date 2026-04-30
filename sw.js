// Service worker. Cache-first strategy with versioned cache name.
//
// Why cache-first: this app does no network work after the first load — there
// are no APIs, no telemetry, no remote assets. Cache-first gives instant cold
// boot and works fully offline.
//
// Why hand-rolled: the bundling plugin alternatives are overkill for a static
// app of this size. ~40 lines is auditable; a generated workbox SW is not.

const VERSION = 'mer-pwa-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle GET; bypass the rest (POST, etc., never used by this app).
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // Only cache same-origin successful responses.
          const url = new URL(req.url);
          if (url.origin === location.origin && resp.ok) {
            const clone = resp.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
    }),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

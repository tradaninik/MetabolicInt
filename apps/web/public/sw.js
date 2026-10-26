// Offline shell - caches the app shell for PWA install and offline use.
// v3 strategy (P5-b):
//   - network-first for navigations, falling back to the cached copy of that
//     page (pages you've visited stay readable offline), then to /offline.
//   - cache-first for hashed static assets only.
//   - API responses are NEVER cached - logged data must be fresh. Offline
//     meal logging is handled by the app's IndexedDB queue, not by caching.
//   - Background Sync: when connectivity returns, the SW messages open
//     clients so the page can replay the queued meals. If no page is open
//     (iOS, or a fully-closed app), the queue flushes on the next launch.
const CACHE = 'mi-shell-v3';
const SHELL = [
  '/',
  '/login',
  '/install',
  '/offline',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API data must always come from the network - never serve cached API JSON.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            // Visited pages replay offline; unknown URLs get the calm fallback.
            .then((r) => r || caches.match('/offline'))
            .then((r) => r || caches.match('/')),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});

// Background Sync (Chromium): connectivity is back and the tag we registered
// fired. Message every open client so the page replays its IndexedDB meal
// queue through the normal authenticated fetch path.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'mi-meal-sync') return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'MI_SYNC_MEALS' });
      }
    }),
  );
});

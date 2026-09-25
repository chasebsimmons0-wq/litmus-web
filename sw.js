// Offline shell. Network first, so an update is picked up as soon as there is a
// connection; the cache is only the fallback. Data never passes through here — it
// lives in IndexedDB.

const CACHE = 'litmus-v7';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './engine.js', './store.js',
  './content.js', './reporting.js', './tracking.js', './reminders.js', './safety.js', './record.js', './mascot.js', './insight.js', './community.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    // Revalidated every time, so the HTTP cache can never serve a stale file beside
    // fresh ones — a mismatched set of modules is worse than an offline one.
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});

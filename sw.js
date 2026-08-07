/**
 * sw.js — Service worker for offline support.
 *
 * Caches the app shell (HTML, CSS, JS, icons, fonts) on install so the UI
 * loads and works fully offline. Translation itself still needs the network
 * (Google's endpoint), so offline mode lets you load files and use the
 * preview player, but translating requires a connection.
 */
const CACHE = 'kurdish-translator-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/parser.js',
  './assets/js/translator.js',
  './assets/js/player.js',
  './assets/js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for same-origin assets, network-only for Google Translate.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin (Google Translate) requests.
  if (url.origin !== location.origin) return;

  // Only handle GET.
  if (event.request.method !== 'GET') return;

  // Navigations: serve the app shell from cache, fall back to network, then to
  // the cached shell so offline reloads still render the UI.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).catch(() => caches.match('./'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Serve from cache immediately, then refresh it in the background.
      const fetched = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

/**
 * sw.js — Service worker for offline support and Web Share Target handling.
 *
 * Caches the app shell (HTML, CSS, JS, icons, fonts) on install so the UI
 * loads and works fully offline. Translation itself still needs the network
 * (Google's endpoint), so offline mode lets you load files and use the
 * preview player, but translating requires a connection.
 */
const CACHE = 'kurdish-translator-v103';
const SHARED_CACHE = 'kurdish-shared-file';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/variables.css',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/translation.css',
  './assets/css/player.css',
  './assets/css/editor.css',
  './assets/css/fullscreen.css',
  './assets/css/toast.css',
  './assets/css/style.css',
  './assets/js/i18n.js',
  './assets/js/toast.js',
  './assets/js/parser.js',
  './assets/js/translator-dict.js',
  './assets/js/translator-orthography.js',
  './assets/js/translator.js',
  './assets/js/player.js',
  './assets/js/app-version.js',
  './assets/js/app-tour.js',
  './assets/js/app-quality.js',
  './assets/js/app-fullscreen.js',
  './assets/js/app-file.js',
  './assets/js/app-editor.js',
  './assets/js/app.js',
  './assets/icons/icon.svg',
  './assets/icons/anime-logo.svg',
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
      Promise.all(keys.filter((k) => k !== CACHE && k !== SHARED_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Message listener for client controls
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  } else if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE });
    }
  }
});

// Fetch: cache-first for same-origin assets, handle Web Share Target POST requests.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Web Share Target POST request
  if (event.request.method === 'POST' && url.searchParams.has('share_target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('subtitle_file') || formData.get('file');

          if (file && file instanceof File) {
            const cache = await caches.open(SHARED_CACHE);
            const headers = new Headers();
            headers.append('X-Shared-Filename', encodeURIComponent(file.name));
            headers.append('Content-Type', file.type || 'text/plain');

            const response = new Response(await file.arrayBuffer(), { headers });
            await cache.put('./shared-subtitle', response);
          }
        } catch (err) {
          console.error('Share target handling error:', err);
        }
        return Response.redirect('./?shared=1', 303);
      })()
    );
    return;
  }

  // Never intercept cross-origin (Google Translate) requests.
  if (url.origin !== location.origin) return;

  // Only handle GET.
  if (event.request.method !== 'GET') return;

  // Endpoint to retrieve shared subtitle payload
  if (url.pathname.endsWith('/shared-subtitle-data') || url.searchParams.has('get_shared')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHARED_CACHE);
        const match = await cache.match('./shared-subtitle');
        if (match) {
          await cache.delete('./shared-subtitle');
          return match;
        }
        return new Response('null', { status: 404 });
      })()
    );
    return;
  }

  // Navigations: try network first to get latest version when online, fall back
  // to cached app shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
            return response;
          }
          return caches.match(event.request).then((cached) => cached || caches.match('./'));
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./')))
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


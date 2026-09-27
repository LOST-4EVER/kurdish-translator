/**
 * sw.js — Service worker for offline support and Web Share Target handling.
 *
 * Caches the app shell (HTML, CSS, JS, icons, fonts) on install so the UI
 * loads and works fully offline. Translation itself still needs the network
 * (Google's endpoint), so offline mode lets you load files and use the
 * preview player, but translating requires a connection.
 */
const CACHE = 'kurdish-translator-v175';
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
  './assets/video-editor/video-editor.css',
  './assets/video-editor/video-editor-exporter.css',
  './assets/video-editor/video-editor-panels.css',
  './assets/video-editor/video-editor-responsive.css',
  './assets/video-editor/video-editor-mobile.css',
  './assets/video-editor/video-editor.html',
  './assets/video-editor/wasm-engine.js',
  './assets/video-editor/video-editor-ui.js',
  './assets/video-editor/video-editor-state.js',
  './assets/video-editor/video-editor-hardware.js',
  './assets/video-editor/video-editor-player.js',
  './assets/video-editor/video-editor-overlay.js',
  './assets/video-editor/video-editor-inspector.js',
  './assets/video-editor/video-editor-popovers.js',
  './assets/video-editor/video-editor-burner.js',
  './assets/video-editor/mkv-importer.js',
  './assets/video-editor/mov-importer.js',
  './assets/video-editor/timeline.js',
  './assets/video-editor/video-editor-bubble.js',
  './assets/video-editor/video-editor.js',
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
  './assets/js/app-storage.js',
  './assets/js/app-decoder.js',
  './assets/js/app-editor.js',
  './assets/js/app.js',
  './404.html',
  './assets/icons/icon.svg',
  './assets/icons/anime-logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

// Install: pre-cache the app shell.
// Each asset is fetched independently: cache.addAll() is all-or-nothing, so a
// single 404 used to leave the whole app with an empty cache and no offline
// support at all, while still installing successfully.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((asset) =>
        cache.add(new Request(asset, { cache: 'reload' })).catch((err) => {
          console.warn('SW pre-cache skipped asset:', asset, err && err.message);
        })
      )))
      .then(() => self.skipWaiting())
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
  const isSkipWaiting = event.data === 'SKIP_WAITING' ||
    event.data.type === 'SKIP_WAITING' ||
    event.data.action === 'skipWaiting' ||
    event.data.action === 'SKIP_WAITING';

  if (isSkipWaiting) {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_ALL_CACHES' || event.data === 'CLEAR_ALL_CACHES') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    }).catch((err) => {
      console.error('Cache clear error:', err);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: err ? err.message : 'Unknown error' });
      }
    });
  } else if (event.data.type === 'GET_VERSION' || event.data === 'GET_VERSION') {
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

  // Range requests (e.g. video / audio playback in editor): browser network handles partial responses
  if (event.request.headers && event.request.headers.has('range')) return;

  // Never cache or intercept dynamic backend API proxy requests.
  if (url.pathname.startsWith('/api/')) return;

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
          if (response && response.ok && response.status === 200) {
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
      if (cached) {
        // Stale-while-revalidate: serve cached immediately, update in background
        fetch(event.request)
          .then((response) => {
            if (response && response.ok && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch((err) => {
          // Offline and uncached: fail with a real Response instead of an
          // unhandled rejection, so the page can show its own offline UI.
          if (event.request.destination === 'document') {
            return caches.match('./index.html').then((shell) => shell || new Response(
              '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;background:#0b0d12;color:#f1f3f9;display:grid;place-items:center;height:100vh;margin:0"><h1>You are offline</h1><p>Reconnect once to finish caching the app.</p>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ));
          }
          throw err;
        });
    })
  );
});


/* ===========================================================
   StepBy UI1 — Service worker

   Caching strategy, and why:

     HTML + JS + CSS + i18n   network-first
        A deploy must be visible on the very next load. Stale-while-revalidate
        looked attractive here, but it serves the previous copy and refreshes
        behind the scenes — so a freshly deployed page can run one-generation-old
        JavaScript for a whole session. Version skew between markup and code is
        exactly the class of bug this rebuild exists to remove. The cached copy
        is still there as the offline fallback.

     fonts, images, vendor    stale-while-revalidate
        Effectively immutable, and worth serving instantly.

     API / auth               never cached
        Stale accessibility data is worse than none, and a cached authenticated
        response would leak between accounts.
   =========================================================== */

const VERSION = '2.0.0';
const SHELL_CACHE = `stepby-ui4-shell-${VERSION}`;
const ASSET_CACHE = `stepby-ui4-assets-${VERSION}`;

/* Scope-relative so the same file works at /StepBy/UI4/, at the domain root,
   or on a local dev server without editing anything. */
const BASE = new URL('./', self.registration.scope).pathname;
const p = (path) => BASE + path;

const SHELL = [
  p(''),
  p('index.html'),
  p('offline.html'),
  p('manifest.webmanifest'),
  p('css/fonts.css'),
  p('css/tokens.css'),
  p('css/base.css'),
  p('css/components.css'),
  p('js/config.js'),
  p('js/prefs.js'),
  p('js/icons.js'),
  p('vendor/leaflet/leaflet.js'),
  p('vendor/leaflet/leaflet.css'),
  p('js/i18n.js'),
  p('js/auth.js'),
  p('js/geo.js'),
  p('js/mapprefs.js'),
  p('js/api.js'),
  p('js/ui.js'),
  p('i18n/dict.js'),
  p('assets/icon-192.png'),
  p('assets/avatar-placeholder.svg'),
  p('assets/fonts/noto-sans-latin-400.woff2'),
  p('assets/fonts/noto-sans-latin-500.woff2'),
  p('assets/fonts/noto-sans-latin-700.woff2'),
  p('detail/'),
  p('ranking/'),
  p('onboarding/'),
  p('profile-edit/'),
  p('login/'),
  p('map/'),
  p('feed/'),
  p('post/'),
  p('mine/'),
  p('profile/'),
  p('settings/'),
  p('help/')
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    /* One bad URL must not fail the whole install, so add them individually. */
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) await cache.put(url, res);
      } catch (err) {
        /* Precaching is best-effort; the runtime handlers cover the rest. */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/** Let the page trigger an immediate update instead of waiting a navigation. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  /* ignoreSearch so a ?v= cache-buster still hits the stored copy. */
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || network.then((r) => r || Promise.reject(new Error('offline')));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Backend traffic is never cached: stale accessibility data is worse than
     no data, and cached authenticated responses leak between accounts. */
  if (isApiRequest(url) || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, p('offline.html')));
    return;
  }

  /* Code and copy: freshness wins, cache is the offline fallback.
     Everything else (fonts, images, Leaflet): speed wins. */
  if (/\.(?:js|mjs|css|json|webmanifest)$/.test(url.pathname) &&
      !url.pathname.includes('/vendor/')) {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});

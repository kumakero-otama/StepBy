const CACHE_NAME = 'stepby-ui1-v31';
const BASE = '/StepBy/UI1';
const ASSETS = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/common.css',
    BASE + '/common.js',
    BASE + '/config.js',
    BASE + '/token_client.js',
    BASE + '/i18n.js',
    BASE + '/manifest.webmanifest',
    BASE + '/assets/icon-192.png',
    BASE + '/assets/icon-512.png',
    BASE + '/map/Index.html',
    BASE + '/map/map.js',
    BASE + '/profile/Index.html',
    BASE + '/profile_edit/Index.html',
    BASE + '/post_road/Index.html',
    BASE + '/road_info_detail/Index.html',
    BASE + '/road_info_detail/road_info_detail.js',
    BASE + '/signup/Index.html',
    BASE + '/settings/display.html',
    BASE + '/settings/language.html',
    BASE + '/help/Index.html',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Bypass HTTP cache explicitly to ensure Android devices get the latest files
            return Promise.all(
                ASSETS.map(url => {
                    return fetch(new Request(url, { cache: 'reload' }))
                        .then(response => {
                            if (response.ok) return cache.put(url, response);
                        })
                        .catch(err => console.warn('[SW] Cache prefetch failed for:', url, err));
                })
            );
        })
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API calls: network only (never cache)
    if (url.hostname.includes('loophole.site') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Static assets: cache-first, fallback to network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});


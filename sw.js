const CACHE_NAME = 'ekraah-v1';

// Resolve base path from the service worker's registration scope.
// On GitHub Pages (e.g. /ekRAAH/) this becomes '/ekRAAH/' instead of '/'.
const BASE = self.registration.scope || '/';

// Local assets to precache (resolved relative to scope)
const LOCAL_ASSETS = [
    'index.html',
    'css/styles.css',
    'js/app.js',
    'js/supabase-config.js',
    'js/router.js',
    'js/auth.js',
    'js/state.js',
    'assets/full-logo.png',
    'assets/mini-logo.png',
];

// External CDN assets — these may fail (CORS, redirects, large bundles)
// so we cache them individually and silently skip failures.
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    // NOTE: We intentionally DO NOT precache the Supabase JS SDK.
    // It is served as a redirect from jsdelivr and the full bundle is ~1 MB.
    // The network-first fetch handler will cache it on first real use.
];

// Resolve local paths against the service worker scope
function resolveLocal(path) {
    // Avoid double-slash when BASE ends with '/' and path starts without '/'
    return new URL(path, BASE).href;
}

// Install: precache essential assets
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            // 1. Cache local assets atomically (these should always succeed)
            const localUrls = LOCAL_ASSETS.map(resolveLocal);

            // 2. Cache CDN assets individually — skip any that fail
            var cdnPromises = CDN_ASSETS.map(function (url) {
                return cache.add(url).catch(function (err) {
                    console.warn('ekRAAH SW: skipped caching CDN asset:', url, err.message);
                });
            });

            return cache
                .addAll(localUrls)
                .then(function () {
                    // Local assets cached; now try CDN assets (non-blocking)
                    return Promise.all(cdnPromises);
                })
                .catch(function (err) {
                    // If even local assets fail, log but don't block installation
                    console.error('ekRAAH SW: precache failed:', err.message);
                });
        }),
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (name) {
                        return name !== CACHE_NAME;
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    }),
            );
        }),
    );
    self.clients.claim();
});

// Fetch: Network First, fallback to Cache
self.addEventListener('fetch', function (event) {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(function (networkResponse) {
                // Clone and cache the successful response
                if (networkResponse && networkResponse.status === 200) {
                    var clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clonedResponse);
                    });
                }
                return networkResponse;
            })
            .catch(function () {
                // Network failed, serve from cache
                return caches.match(event.request).then(function (cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // For navigation requests that aren't cached, serve index.html (SPA)
                    if (event.request.mode === 'navigate') {
                        return caches.match(resolveLocal('index.html'));
                    }
                    return undefined;
                });
            }),
    );
});

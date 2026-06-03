const CACHE_NAME = 'ekraah-v1';

const PRECACHE_URLS = [
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/supabase-config.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/state.js',
  '/assets/full-logo.png',
  '/assets/mini-logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: precache essential assets
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
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
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network First, fallback to Cache
self.addEventListener('fetch', function (event) {
  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        // Clone the response before caching
        var clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clonedResponse);
        });
        return networkResponse;
      })
      .catch(function () {
        // Network failed, serve from cache
        return caches.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests that aren't cached, serve index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return undefined;
        });
      })
  );
});

const CACHE_NAME = 'jisheng-music-v1';

// Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch (Network First, falling back to cache)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // We only intercept GET requests for static assets, pages, etc.
  // Ignore APIs, Hot Reload, chrome extensions, and range requests (for audio files, which should stream)
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.url.includes('/_next/webpack-hmr') ||
    request.url.startsWith('chrome-extension:') ||
    request.headers.get('range')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // If response is valid, cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(request);
      })
  );
});

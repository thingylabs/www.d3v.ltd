// service-worker.js
const CACHE_NAME = 'd3v-site-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/flag-of-seychelles.png',
  '/assets/github-mark.png',
  '/assets/android-chrome-192x192.png',
  '/assets/android-chrome-512x512.png',
  '/site.webmanifest',
  'https://plausible.io/js/script.js'
];

// Install event - Cache essential assets
self.addEventListener('install', event => {
  self.skipWaiting(); // Ensure new service worker activates immediately
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - Network first with fallback to cache strategy
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('plausible.io')) {
    return;
  }
  
  event.respondWith(
    // Try the network first
    fetch(event.request.clone())
      .then(response => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone and cache valid responses
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
          
        return response;
      })
      .catch(error => {
        // Network failed, try to serve from cache
        console.log('Fetch failed, serving from cache:', error);
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If there's nothing in the cache, try to get the offline page
            return caches.match('/index.html');
          });
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic sync to maintain background refresh cycle
self.addEventListener('periodicsync', event => {
  if (event.tag === 'refresh-content') {
    event.waitUntil(
      fetch('/')
        .then(response => {
          if (response && response.status === 200) {
            return caches.open(CACHE_NAME).then(cache => {
              return cache.put('/', response);
            });
          }
        })
        .catch(error => {
          console.log('Background sync failed:', error);
        })
    );
  }
});

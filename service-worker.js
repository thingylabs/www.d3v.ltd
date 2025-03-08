// service-worker.js - simplified version with favicon support
const CACHE_NAME = 'd3v-site-cache-v1';
const OFFLINE_URL = '/index.html';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/flag-of-seychelles.png',
  '/assets/github-mark.png',
  '/favicon.ico',
  '/favicon-bw.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-bw-16x16.png',
  '/favicon-bw-32x32.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-bw.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/android-chrome-192x192-bw.png',
  '/android-chrome-512x512-bw.png',
  '/site.webmanifest',
  'https://plausible.io/js/script.js'
];

// Install event - Cache essential assets
self.addEventListener('install', event => {
  console.log('Service Worker installing');
  self.skipWaiting(); // Ensure new service worker activates immediately
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache assets:', error);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - Network first with fallback to cache
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Special handling for favicon and icon files
  if (event.request.url.includes('favicon') || 
      event.request.url.includes('apple-touch-icon') ||
      event.request.url.includes('android-chrome')) {
    
    // Determine if this is a color or BW request
    const isColorVersion = !event.request.url.includes('-bw');
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // If we're offline and requesting a color version, 
              // try to return the corresponding BW version
              if (isColorVersion) {
                // Convert the URL to its BW equivalent
                const urlPath = new URL(event.request.url).pathname;
                let bwUrl;
                
                if (urlPath.includes('favicon') && urlPath.endsWith('.ico')) {
                  bwUrl = '/favicon-bw.ico';
                } else if (urlPath.includes('favicon-16x16')) {
                  bwUrl = '/favicon-bw-16x16.png';
                } else if (urlPath.includes('favicon-32x32')) {
                  bwUrl = '/favicon-bw-32x32.png';
                } else if (urlPath.includes('apple-touch-icon')) {
                  bwUrl = '/apple-touch-icon-bw.png';
                } else if (urlPath.includes('android-chrome-192x192')) {
                  bwUrl = '/android-chrome-192x192-bw.png';
                } else if (urlPath.includes('android-chrome-512x512')) {
                  bwUrl = '/android-chrome-512x512-bw.png';
                } else {
                  bwUrl = '/favicon-bw.ico'; // Default fallback
                }
                
                return caches.match(bwUrl);
              }
              
              // If all else fails, return nothing
              return null;
            });
        })
    );
    return;
  }
  
  // Handle HTML navigation requests
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept')?.includes('text/html'))) {
    
    event.respondWith(
      fetch(event.request).catch(() => {
        console.log('Offline, serving from cache');
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }
  
  // For all other requests
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for later use
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try to serve from cache
        return caches.match(event.request);
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// service-worker.js
const CACHE_NAME = 'd3v-site-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/flag-of-seychelles.png',
  '/assets/github-mark.png',
  '/assets/android-chrome-192x192.png',
  '/assets/android-chrome-512x512.png',
  '/site.webmanifest',
  '/background-sync.js',
  'https://plausible.io/js/script.js'
];

// Install event - Cache essential assets
self.addEventListener('install', event => {
  self.skipWaiting(); // Ensure new service worker activates immediately
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        
        // First, cache the index.html with highest priority
        return cache.add('/')
          .then(() => {
            // Then cache the rest of the assets
            return cache.addAll(urlsToCache);
          })
          .catch(error => {
            console.error('Failed to cache assets:', error);
          });
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

// Fetch event - Cache first for html/document requests, network first for everything else
self.addEventListener('fetch', event => {
  // Skip cross-origin requests except for critical resources
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('plausible.io')) {
    return;
  }
  
  // Parse the URL to get the pathname
  const url = new URL(event.request.url);
  
  // Check if this is a navigation request (for a document/HTML)
  const isNavigationRequest = event.request.mode === 'navigate';
  
  // Check if this is a request for the main page or other HTML resources
  const isHTMLRequest = isNavigationRequest || 
                        url.pathname === '/' || 
                        url.pathname.endsWith('.html') ||
                        url.pathname === '' ||
                        event.request.headers.get('Accept')?.includes('text/html');
  
  if (isHTMLRequest && navigator.onLine === false) {
    // For HTML requests when offline, go to cache first
    event.respondWith(
      caches.match('/index.html')
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If index.html isn't cached, try the offline page
          return caches.match('/offline.html')
            .then(offlineResponse => {
              if (offlineResponse) {
                return offlineResponse;
              }
              
              // If offline page isn't cached, try the network
              return fetch(event.request)
                .catch(() => {
                  // Create a simple offline response if nothing else works
                  return new Response(
                    '<html><body><h1>Currently offline</h1><p>Please try again when you have a network connection.</p></body></html>',
                    { headers: { 'Content-Type': 'text/html' } }
                  );
                });
            });
        })
    );
    return;
  }
  
  // For all other requests, use network first with cache fallback
  event.respondWith(
    fetch(event.request.clone())
      .then(response => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200) {
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
            
            // For HTML requests, serve the index page
            if (isHTMLRequest) {
              return caches.match('/index.html');
            }
            
            // For other resources, we can't provide a fallback
            return new Response('Not found in cache', { status: 404 });
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

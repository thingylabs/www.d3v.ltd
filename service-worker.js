// service-worker.js - simplified version
const CACHE_NAME = 'd3v-site-cache-v1';
const OFFLINE_URL = '/index.html';
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
  
  // Handle HTML navigation requests
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept').includes('text/html'))) {
    
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

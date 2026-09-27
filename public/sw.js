// HardwareDesk High-Reliability PWA Service Worker
const CACHE_NAME = 'hardwaredesk-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge old conflicting v1 caches
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Let Next.js and browser handle all dynamic navigation, RSC, and Server Actions natively
self.addEventListener('fetch', (event) => {
  // Do NOT intercept POST, PUT, DELETE, Server Actions, or Next.js internal calls
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only cache static icons & manifest, leave all pages and API requests to native network
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json' || url.pathname === '/favicon.ico') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

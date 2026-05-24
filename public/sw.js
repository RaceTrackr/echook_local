// Minimal service worker — satisfies PWA installability requirement.
// No caching: all requests pass through to the network so live telemetry is never stale.
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
self.addEventListener('fetch',    (e) => e.respondWith(fetch(e.request)))

/* BUILD_CONFIG */
const ROOT = new URL('./', self.registration.scope).pathname;
const PREFIX = 'chronos:' + ROOT + ':';
const CACHE = PREFIX + (typeof VERSION === 'undefined' ? 'dev' : VERSION);
self.addEventListener('install', event => {
  if (typeof ASSETS === 'undefined') return;
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE') self.skipWaiting();
  if (event.data === 'STATUS') event.ports[0]?.postMessage({ ready: typeof ASSETS !== 'undefined' });
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n.startsWith(PREFIX) && n !== CACHE).map(n => caches.delete(n)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      const page = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      return await cache.match(page) || fetch(event.request);
    }
    return await cache.match(event.request, { ignoreSearch: true }) || fetch(event.request);
  })());
});

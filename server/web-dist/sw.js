const CACHE = 'imx-app-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/users') ||
    url.pathname.startsWith('/conversations') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/notifications') ||
    url.pathname.startsWith('/friends') ||
    url.pathname.startsWith('/health')
  ) {
    return;
  }

  // Always take network for HTML/navigation so deploys show up immediately.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && url.pathname.startsWith('/assets/')) {
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  );
});

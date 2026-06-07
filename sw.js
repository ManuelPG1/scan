const CACHE_NAME = 'escaner-v5';

const ASSETS = [
  './',
'./index.html',
'./estilos.css',
'./app.js',
'./manifest.json',
'./icono-192.png',
'./icono-512.png',
'./dni-seguro.js',
'./herramientas-pdf.js',
];

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),

                caches.keys().then(keys =>
                Promise.all(
                  keys
                  .filter(key => key !== CACHE_NAME)
                  .map(key => caches.delete(key))
                )
                )
    ])
  );
});

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
    .then(cachedResponse => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
      .then(networkResponse => {

        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        }

        return networkResponse;
      });
    })
  );
});

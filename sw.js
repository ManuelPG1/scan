// Asignamos un nombre y versión a la caché
const CACHE_NAME = 'aethel-escaner-v1';

const urlsToCache = [
  './',
  './index.html',
  './estilos.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el archivo está en caché, lo devuelve. Si no, lo busca en internet.
        return response || fetch(event.request);
      })
  );
});

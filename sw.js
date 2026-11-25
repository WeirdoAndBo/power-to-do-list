// Offline-Cache der Power-Liste. Es gibt keine Netzwerkaufrufe außer zum Laden der eigenen Dateien.
// Bei jeder Änderung an den App-Dateien VERSION erhöhen (und APP_VERSION in js/app.js gleich setzen),
// sonst bekommen installierte Apps die neue Fassung nicht.
const VERSION = '1.0.13-c';
const CACHE = 'powerliste-' + VERSION;
const FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// Installieren: alle Dateien frisch aus dem Netz holen ('reload' umgeht den Browser-Cache) und ablegen.
self.addEventListener('install', event => {
  const requests = FILES.map(file => new Request(file, { cache: 'reload' }));
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(requests))
      .then(() => self.skipWaiting())
  );
});

// Aktivieren: alte Fassungen der Power-Liste aus dem Cache löschen.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => keys.filter(key => key.startsWith('powerliste-') && key !== CACHE))
      .then(oldKeys => Promise.all(oldKeys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Zuerst aus dem Cache, sonst aus dem Netz. Seitenaufrufe ohne Netz bekommen immer die App.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).catch(() => {
      if (request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});

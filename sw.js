// Offline-Cache der Power-Liste. Es gibt keine Netzwerkaufrufe außer zum Laden der eigenen Dateien.
// Bei jeder Änderung an den App-Dateien VERSION erhöhen (am besten gleich APP_VERSION in js/app.js),
// sonst bekommen installierte Apps die neue Fassung nicht.
const VERSION = '1.0.2';
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

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('powerliste-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Zuerst aus dem Cache, sonst aus dem Netz. Seitenaufrufe ohne Netz bekommen immer die App.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});

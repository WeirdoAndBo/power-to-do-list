// Offline-Cache der Power-Liste. Es gibt keine Netzwerkaufrufe außer zum Laden der eigenen Dateien.
// Bei jeder Änderung an den App-Dateien VERSION erhöhen (und APP_VERSION in js/app.js gleich setzen).
// Die neue VERSION sorgt dafür, dass der Browser den neuen Service Worker installiert und die App
// sich einmal neu lädt. Die Dateien selbst holt der Service Worker immer zuerst aus dem Netz.
const VERSION = '1.0.53-c';
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
// So lange wartet die App auf das Netz, bevor sie die Fassung aus dem Offline-Cache zeigt.
const NETWORK_TIMEOUT_MS = 4000;

// Wichtig für die Daten: Die To-Dos liegen im localStorage, NICHT in diesen Caches.
// Der Service Worker fasst den localStorage nie an. Er löscht nur seine eigenen Caches „powerliste-…“.

// Installieren: alle Dateien frisch aus dem Netz holen ('reload' umgeht den Browser-Cache) und ablegen.
// skipWaiting: die neue Fassung übernimmt sofort, statt zu warten, bis alle Fenster der App zu sind.
self.addEventListener('install', event => {
  const requests = FILES.map(file => new Request(file, { cache: 'reload' }));
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(requests))
      .then(() => self.skipWaiting())
  );
});

// Aktivieren: alte Fassungen der App-Dateien aus dem Cache löschen (nur Caches „powerliste-…“).
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => keys.filter(key => key.startsWith('powerliste-') && key !== CACHE))
      .then(oldKeys => Promise.all(oldKeys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Zuerst aus dem Netz (am Browser-Cache vorbei), damit neue Fassungen sofort ankommen,
// auch wenn jemand vergessen hat, VERSION zu erhöhen. Was aus dem Netz kommt, wird im Cache aufgefrischt.
// Ohne Netz (oder wenn es länger als NETWORK_TIMEOUT_MS dauert) kommt die Fassung aus dem Cache.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request, event));
});

function networkFirst(request, event) {
  const fromNetwork = fetch(request, { cache: 'no-cache' }).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  });
  const fromCache = () => caches.match(request, { ignoreSearch: true })
    .then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  return new Promise(resolve => {
    let done = false;
    const finish = response => { if (!done && response) { done = true; resolve(response); } };
    // Netz zu langsam: Cache zeigen, falls vorhanden. Das Netz frischt den Cache trotzdem im Hintergrund auf.
    const timer = setTimeout(() => fromCache().then(finish), NETWORK_TIMEOUT_MS);
    fromNetwork
      .then(response => { clearTimeout(timer); finish(response); })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then(cached => finish(cached || Response.error()));
      });
  });
}

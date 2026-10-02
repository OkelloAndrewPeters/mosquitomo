// MosquitoMo service worker: the app opens offline; readings are cached by the app itself.
const VERSION = 'mm-v3';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/engine.js', './js/data.js', './js/content.js', './js/backend.js', './js/config.js',
  './icons/mark.svg', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== VERSION + '-ext').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // live data: always go to the network (the app keeps its own cache of readings)
  if (/open-meteo\.com|nominatim|overpass|supabase/.test(url.hostname)) return;

  // app files: network first so updates arrive, cache as fallback for offline
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // fonts, Leaflet, map tiles: cache first
  if (/fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap\.org/.test(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(VERSION + '-ext').then((c) => c.put(e.request, copy));
        return r;
      }))
    );
  }
});

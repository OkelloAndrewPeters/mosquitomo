// MosquitoMo service worker.
// - App code (HTML/JS/CSS): NETWORK-FIRST with a 3 s timeout, so phones get updates on the same link,
//   and fall back to the saved copy when offline or on a very slow connection.
// - Big, rarely-changing files (AI model, WebAssembly runtime, map library, icons): CACHE-FIRST.
// - Precaching uses cache:'reload' so a new version never stores a stale copy from the HTTP cache.
// - Weather, places and Supabase calls go straight to the network; the app keeps its own saved data.
const VERSION = '2026-10-07.2';
const CACHE = 'mm-' + VERSION;
const EXT = 'mm-ext';
const CORE = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/engine.js', './js/data.js', './js/content.js', './js/backend.js', './js/config.js',
  './js/places-ug.js', './js/sitenet.js', './icons/mark.svg', './icons/icon-192.png', './icons/icon-512.png',
];
const HEAVY = [
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/ort/ort.wasm.min.mjs', './vendor/ort/ort-wasm-simd-threaded.mjs', './vendor/ort/ort-wasm-simd-threaded.wasm',
  './models/sitenet.onnx', './models/sitenet_meta.json',
];
const isHeavy = (url) => /\/(vendor|models|icons)\//.test(url.pathname) && !url.pathname.endsWith('sitenet_meta.json');

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
  // Heavy files: reuse the previous version's copy if present (no re-download), else fetch.
  for (const u of HEAVY) {
    const old = await caches.match(u);
    if (old && !u.includes('sitenet')) await c.put(u, old);
    else await c.add(new Request(u, { cache: 'reload' })).catch(() => {});
  }
  self.skipWaiting();
})()));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k !== EXT) await caches.delete(k);
  await self.clients.claim();
})()));

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/open-meteo\.com|nominatim|overpass|supabase/.test(url.hostname)) return;

  if (url.origin === location.origin) {
    if (isHeavy(url)) {
      e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })));
      return;
    }
    e.respondWith((async () => {
      try {
        const r = await Promise.race([fetch(e.request, { cache: 'no-cache' }), timeout(3000)]);
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      } catch {
        return (await caches.match(e.request, { ignoreSearch: true })) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // fonts and map tiles: cache first
  if (/fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap\.org/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(EXT).then((c) => c.put(e.request, copy));
      return r;
    })));
  }
});

// Offline shell for StudWars. Bump CACHE when any asset changes.
const CACHE = 'studwars-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/world.js',
  './js/ai.js',
  './js/map.js',
  './js/path.js',
  './js/models.js',
  './js/render.js',
  './js/input.js',
  './js/ui.js',
  './js/audio.js',
  './js/config.js',
  './js/vendor/three.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Skip the browser's HTTP cache so a new version never installs old files.
      .then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Network first, so an update is picked up on the next load; the cache is
  // only the offline answer.
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request.mode === 'navigate' ? './index.html' : request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// Offline shell for Crownfall. Bump CACHE when any asset changes.
const CACHE = 'crownfall-v31';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/map.js',
  './js/models.js',
  './js/input.js',
  './js/vendor/three.js',
  './js/world.js',
  './js/render.js',
  './js/ui.js',
  './js/config.js',
  './js/audio.js',
  './js/save.js',
  './js/terrain.js',
  './js/camera.js',
  './js/slice.js',
  './js/units.js',
  './js/buildings.js',
  './js/regions.js',
  './js/util.js',
  './icons/ui/gold.png',
  './icons/ui/wood.png',
  './icons/ui/stone.png',
  './icons/ui/iron.png',
  './icons/ui/people.png',
  './icons/ui/bank.png',
  './icons/ui/bow.png',
  './icons/ui/crossbow.png',
  './icons/ui/fire.png',
  './icons/ui/multi.png',
  './icons/ui/storm.png',
  './icons/ui/axe.png',
  './icons/ui/pickaxe.png',
  './icons/ui/build.png',
  './icons/ui/king.png',
  './icons/ui/orders.png',
  './icons/ui/posts.png',
  './icons/ui/follow.png',
  './icons/ui/wave.png',
  './icons/ui/greenwood.png',
  './icons/ui/eastern_mountains.png',
  './icons/ui/iron_hills.png',
  './icons/ui/sunscorch.png',
  './icons/ui/frostmarch.png',
  './icons/ui/warlord.png',
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

  // Network first for everything, so an update is picked up on the next load;
  // the cache is only the offline answer.
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

// Service worker: makes the testbed installable and usable offline.
//
// Strategy: network first, cache fallback. Online you always get the latest
// deployed files; offline the last cached copy still opens. Only same-origin
// GET requests are handled (the app makes no other requests).

const CACHE = 'ct-ui-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/dom.js',
  './js/state.js',
  './js/components/header.js',
  './js/components/sidebar.js',
  './js/components/rail.js',
  './js/views/workflow.js',
  './js/views/tasks.js',
  './js/views/overview.js',
  './js/views/docs.js',
  './icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Drop caches from older versions of this worker.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit ?? (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});

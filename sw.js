const CACHE_NAME = 'mi-espanol-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/modules/vocab.css',
  '/js/config.js',
  '/js/supabase.js',
  '/js/srs.js',
  '/js/sync.js',
  '/js/nav.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/modules/vocab.js',
  '/js/modules/grammar.js',
  '/js/modules/listening.js',
  '/js/modules/reading.js',
  '/js/modules/speaking.js',
  '/js/modules/dashboard.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

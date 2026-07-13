const CACHE_NAME = 'mi-espanol-v2';
const BASE = '/mi-espanol';
const SHELL_FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/css/main.css',
  BASE + '/css/modules/vocab.css',
  BASE + '/js/config.js',
  BASE + '/js/supabase.js',
  BASE + '/js/srs.js',
  BASE + '/js/sync.js',
  BASE + '/js/nav.js',
  BASE + '/js/router.js',
  BASE + '/js/auth.js',
  BASE + '/js/modules/vocab.js',
  BASE + '/js/modules/grammar.js',
  BASE + '/js/modules/listening.js',
  BASE + '/js/modules/reading.js',
  BASE + '/js/modules/speaking.js',
  BASE + '/js/modules/dashboard.js',
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

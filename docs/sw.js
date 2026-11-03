// Service worker: makes the app work offline.
// scripts/build.ts fills in VERSION and FILES when it copies this into dist/sw.js.
//
// - App files are downloaded once at install and served from the cache.
// - Google Fonts are cached the first time they load (optional; the app works without them).
// - When a new version is deployed, the old cache is deleted.

const VERSION = '5322b0b564';
const FILES = [
  "./",
  "./app.css",
  "./app.js",
  "./data/chars.json",
  "./data/grammar.json",
  "./data/strokes.json",
  "./data/words.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./manifest.webmanifest"
];
const APP_CACHE = `hsk-app-${VERSION}`;
const FONT_CACHE = 'hsk-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hsk-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  // Cache first; for page navigations fall back to index.html.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) =>
      hit ?? fetch(request).catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
    ),
  );
});

const CACHE_NAME = "photo-taste-mobile-v1";
const BASE = new URL("./", self.location).pathname;
const APP_SHELL = [
  "index.html",
  "styles.css?v=1",
  "app.js?v=1",
  "manifest.webmanifest",
  "icon.svg"
].map((path) => new URL(path, self.location).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(BASE)) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match(new URL("index.html", self.location).toString())))
  );
});


// Service worker básico (Épica F0) — cachea el app shell mínimo y sirve
// GET desde caché con fallback a red. Sin estrategias de actualización en
// segundo plano ni soporte offline real todavía; eso se aborda junto con
// las pantallas reales (Épica F10), no acá.
const CACHE_NAME = "ruteando-shell-v1";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});

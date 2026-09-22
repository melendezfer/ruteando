// Service worker básico (Épica F0, ajustado en Épica F1) — precachea el
// app shell mínimo. Las navegaciones van network-first (ver el fetch
// handler más abajo); el resto de los GET sigue cache-first. Sin
// estrategias de actualización en segundo plano más allá de eso ni
// soporte offline real todavía; eso se aborda junto con las pantallas
// reales (Épica F10), no acá.
//
// Bump CACHE_NAME en cada deploy con cambios visibles de UI (sin RF
// asociado — petición directa del usuario, ver CLAUDE.md): esta
// constante solo se había tocado UNA vez en toda la historia del
// proyecto (v1→v2, Épica F1) y nunca más — verificado con
// `git log -p -- client/public/sw.js`. No es la causa de "veo una
// versión vieja" mientras el usuario navega normal (las navegaciones ya
// van network-first, sin depender de este precache), pero si algo la
// deja desincronizada del build real, `activate` sí purga cualquier
// caché con un nombre distinto — mejor tenerla correcta que confiar en
// que nunca importe. El fix real de "una pestaña/PWA ya abierta se
// queda en el HTML/JS viejo después de un deploy" vive en
// service-worker-register.tsx (ver el comentario ahí sobre
// `controllerchange`), no acá — `skipWaiting()`/`clients.claim()` abajo
// hacen que el SW nuevo tome control de inmediato, pero eso no fuerza a
// una pestaña YA RENDERIZADA a recargar por su cuenta.
const CACHE_NAME = "ruteando-shell-v3";
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

  // Las peticiones de navegación (el documento HTML de una ruta) no pueden
  // ir cache-first: desde la Épica F1, "/" depende de sesión (renderiza
  // "Cargando sesión…" / autenticado / no autenticado según el resultado
  // del refresco silencioso). Cache-first las congelaba para siempre en
  // el snapshot capturado la primera vez que el service worker precacheó
  // el app shell — cualquier F5 real después de eso servía ese HTML viejo
  // en vez de dejar correr una carga nueva, y el refresco silencioso de
  // /auth/refresh nunca llegaba a dispararse. Bug real, encontrado
  // verificando el flujo de F1 de punta a punta contra el backend, no un
  // artefacto de prueba. Network-first (con la caché como respaldo solo
  // si no hay red) es correcto para una página dinámica; el resto de los
  // assets del app shell (manifest, estáticos) se mantiene cache-first.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});

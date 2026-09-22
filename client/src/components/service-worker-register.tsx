"use client";

import { useEffect } from "react";

/**
 * Registro del service worker básico (public/sw.js) — Épica F0, PWA
 * instalable (CLAUDE.md sección 12). Componente cliente montado una sola
 * vez desde el layout raíz; no renderiza nada.
 *
 * Hallazgo real (sin RF asociado, petición directa del usuario, reporte
 * de "sigo viendo cosas viejas en el celular"): `sw.js` ya llama
 * `self.skipWaiting()` + `self.clients.claim()` al activarse, así que un
 * service worker NUEVO toma control de las peticiones de red de
 * inmediato — pero eso no obliga a una pestaña/ventana de PWA que YA
 * estaba abierta (con el HTML/JS viejo ya renderizado en memoria) a
 * recargarse sola. Un celular con la app agregada a la pantalla de
 * inicio, reabierta por el sistema operativo sin pasar por una carga de
 * red nueva, puede seguir mostrando ese snapshot viejo indefinidamente
 * aunque el servidor ya tenga el build más reciente. `controllerchange`
 * (evento estándar, MDN) se dispara precisamente cuando un SW nuevo
 * termina de tomar control — forzar un `location.reload()` ahí cierra
 * ese hueco: la próxima vez que el SW se actualice en segundo plano, la
 * pestaña abierta se refresca sola, sin depender de que la persona sepa
 * que tiene que forzarlo a mano. `refreshing` (mismo patrón que
 * documenta MDN) evita un bucle si el evento llegara a dispararse más
 * de una vez.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("No se pudo registrar el service worker", error);
    });

    let refreshing = false;
    function handleControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}

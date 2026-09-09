"use client";

import { useEffect } from "react";

/**
 * Registro del service worker básico (public/sw.js) — Épica F0, PWA
 * instalable (CLAUDE.md sección 12). Componente cliente montado una sola
 * vez desde el layout raíz; no renderiza nada.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("No se pudo registrar el service worker", error);
    });
  }, []);

  return null;
}

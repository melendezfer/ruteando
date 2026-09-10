"use client";

import { useCallback, useEffect, useState } from "react";

export type GeolocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

interface GeolocationState {
  status: GeolocationStatus;
  coords: { lat: number; lng: number } | null;
}

export interface ConsumerGeolocation extends GeolocationState {
  /**
   * Vuelve a pedir la ubicación — usada por el botón "Mi ubicación" del
   * mapa (fix/mapa-floating-action-stack) para reintentar tras un
   * permiso denegado, o para recentrar sobre la posición actual.
   */
  retry: () => void;
}

/**
 * Ubicación del consumidor para ordenar "cerca de ti" por cercanía
 * (Épica F2) y para el mapa (Épica F3). Se pide al montar y se guarda
 * solo en estado de React — nunca en localStorage/sessionStorage,
 * coherente con CLAUDE.md sección 4 (Ley 1581: la ubicación del
 * consumidor no se persiste salvo que el propio usuario la guarde como
 * preferencia, cosa que esta pantalla no ofrece) y sección 13.4 (no
 * persistir más allá de la sesión activa).
 */
export function useConsumerGeolocation(): ConsumerGeolocation {
  // El estado inicial (si el navegador soporta geolocalización o no) se
  // calcula una sola vez en el inicializador perezoso de useState, no con
  // un setState síncrono dentro del efecto — eso es lo que evalúa el
  // propio render, no algo que dependa de sincronizar con un sistema
  // externo (react-hooks/set-state-in-effect).
  const [state, setState] = useState<GeolocationState>(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return { status: "unavailable", coords: null };
    }
    return { status: "loading", coords: null };
  });

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unavailable", coords: null });
      return;
    }

    setState({ status: "loading", coords: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "granted",
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      },
      () => {
        setState({ status: "denied", coords: null });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    // El `.then()` mueve el setState("loading") síncrono de
    // requestLocation() fuera de la fase síncrona del efecto (mismo
    // motivo documentado en home-screen.tsx, react-hooks/set-state-in-effect).
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) requestLocation();
    });
    return () => {
      ignore = true;
    };
  }, [requestLocation]);

  return { ...state, retry: requestLocation };
}

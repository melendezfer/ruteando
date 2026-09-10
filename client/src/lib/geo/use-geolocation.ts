"use client";

import { useEffect, useState } from "react";

export type GeolocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

interface GeolocationState {
  status: GeolocationStatus;
  coords: { lat: number; lng: number } | null;
}

/**
 * Ubicación del consumidor para ordenar "cerca de ti" por cercanía
 * (Épica F2). Se pide una sola vez al montar y se guarda solo en estado de
 * React — nunca en localStorage/sessionStorage, coherente con CLAUDE.md
 * sección 4 (Ley 1581: la ubicación del consumidor no se persiste salvo
 * que el propio usuario la guarde como preferencia, cosa que esta pantalla
 * no ofrece) y sección 13.4 (no persistir más allá de la sesión activa).
 */
export function useConsumerGeolocation(): GeolocationState {
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

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

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

  return state;
}

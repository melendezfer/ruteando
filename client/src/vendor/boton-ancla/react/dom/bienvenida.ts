"use client";

import {
  BIENVENIDA_INICIAL,
  leerBienvenida,
  marcarDemostracion,
  marcarMano,
  registrarUso,
  serializarBienvenida,
  type EstadoBienvenida,
} from "@boton-ancla/core";
import { useCallback, useEffect, useState } from "react";

// Bienvenida de los primeros usos (HU-12, T-11, T-23). La lógica es del núcleo;
// aquí solo se guarda en localStorage (RNF-08: solo en el dispositivo).

const CLAVE = "boton-ancla:v1:bienvenida";
const EVENTO_REINICIO = "boton-ancla:reiniciar-bienvenida";

function leer(): EstadoBienvenida {
  try {
    return leerBienvenida(window.localStorage.getItem(CLAVE));
  } catch {
    return BIENVENIDA_INICIAL;
  }
}

function guardar(estado: EstadoBienvenida) {
  try {
    window.localStorage.setItem(CLAVE, serializarBienvenida(estado));
  } catch {
    // Navegación privada o almacenamiento bloqueado: la bienvenida se repetirá, no pasa nada.
  }
}

/** Borra el progreso de la bienvenida: la demostración y las pistas vuelven a aparecer. */
export function reiniciarBienvenida() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new Event(EVENTO_REINICIO));
}

export function useBienvenida() {
  // null hasta leer localStorage (solo en el navegador): evita mostrar la demostración por error.
  const [estado, setEstado] = useState<EstadoBienvenida | null>(null);

  useEffect(() => {
    const cargar = () => setEstado(leer());
    cargar();
    window.addEventListener(EVENTO_REINICIO, cargar);
    return () => window.removeEventListener(EVENTO_REINICIO, cargar);
  }, []);

  const usar = useCallback((idAccion: string) => {
    setEstado((e) => {
      const nuevo = registrarUso(e ?? leer(), idAccion);
      guardar(nuevo);
      return nuevo;
    });
  }, []);

  const terminarDemostracion = useCallback(() => {
    setEstado((e) => {
      const nuevo = marcarDemostracion(e ?? leer());
      guardar(nuevo);
      return nuevo;
    });
  }, []);

  // Fase 3 (H13): ya se respondió con qué mano.
  const responderMano = useCallback(() => {
    setEstado((e) => {
      const nuevo = marcarMano(e ?? leer());
      guardar(nuevo);
      return nuevo;
    });
  }, []);

  return { estado, usar, terminarDemostracion, responderMano };
}

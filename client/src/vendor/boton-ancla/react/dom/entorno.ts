"use client";

import { orientacionDe, type Orientacion } from "@boton-ancla/core";
import { useEffect, useRef, useState } from "react";

// Señales del entorno que cancelan la interacción u ocultan el ancla (T-20).

/** Si el alto visible cae más que esto, se asume que hay un teclado virtual abierto. */
const CAIDA_TECLADO_PX = 150;

export type EstadoTeclado = {
  /** Hay un teclado virtual abierto (RF-13, RF-16). */
  abierto: boolean;
  /** Cuánto tapa el teclado por abajo, en px: lo que hay que subir una hoja para que no quede detrás (HM-05). */
  alto: number;
};

/**
 * Teclado virtual, detectado SOLO con visualViewport (HM-04). Antes también contaba "hay
 * un campo enfocado", y en Android el campo sigue enfocado después de bajar el teclado con
 * el botón atrás: el ancla no volvía a aparecer.
 *
 * Se compara el alto visible con el MÁXIMO visto en esa orientación, no con innerHeight:
 * así funciona tanto si el navegador achica solo lo visible (Chrome por defecto, iOS) como
 * si achica toda la ventana (interactive-widget=resizes-content).
 */
export function useTeclado(): EstadoTeclado {
  const [estado, setEstado] = useState<EstadoTeclado>({ abierto: false, alto: 0 });

  useEffect(() => {
    const maximos = new Map<string, number>();
    const revisar = () => {
      const vv = window.visualViewport;
      const orientacion = window.innerWidth > window.innerHeight ? "horizontal" : "vertical";
      const visible = vv ? vv.height : window.innerHeight;
      const maximo = Math.max(maximos.get(orientacion) ?? 0, window.innerHeight, visible);
      maximos.set(orientacion, maximo);
      const abierto = maximo - visible > CAIDA_TECLADO_PX;
      // Lo que queda tapado abajo: de la ventana, lo que no alcanza a mostrar lo visible.
      const alto = vv ? Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))) : 0;
      setEstado((e) => (e.abierto === abierto && e.alto === alto ? e : { abierto, alto }));
    };
    revisar();
    window.visualViewport?.addEventListener("resize", revisar);
    window.visualViewport?.addEventListener("scroll", revisar);
    window.addEventListener("resize", revisar);
    return () => {
      window.visualViewport?.removeEventListener("resize", revisar);
      window.visualViewport?.removeEventListener("scroll", revisar);
      window.removeEventListener("resize", revisar);
    };
  }, []);

  return estado;
}

/** RF-09: llama `alCambiar` cuando cambia la orientación (screen.orientation, o matchMedia en iOS < 16.4: L-11). */
export function useCambioOrientacion(alCambiar: () => void) {
  const ref = useRef(alCambiar);
  useEffect(() => {
    ref.current = alCambiar;
  });

  useEffect(() => {
    const avisar = () => ref.current();
    const orientacion = typeof screen !== "undefined" ? screen.orientation : undefined;
    if (orientacion) {
      orientacion.addEventListener("change", avisar);
      return () => orientacion.removeEventListener("change", avisar);
    }
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", avisar);
    return () => mq.removeEventListener("change", avisar);
  }, []);
}

/**
 * Fase 3 (RF3-07): vertical u horizontal, según el tamaño de la ventana (ancho > alto =
 * horizontal). Se usa la ventana y no la parte visible: el teclado no debe "girar" el ancla.
 */
export function useOrientacion(): Orientacion {
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  useEffect(() => {
    const leer = () => setOrientacion(orientacionDe(window.innerWidth, window.innerHeight));
    leer();
    window.addEventListener("resize", leer);
    window.addEventListener("orientationchange", leer);
    return () => {
      window.removeEventListener("resize", leer);
      window.removeEventListener("orientationchange", leer);
    };
  }, []);
  return orientacion;
}

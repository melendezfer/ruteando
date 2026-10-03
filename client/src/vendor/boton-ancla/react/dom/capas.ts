"use client";

import type { CapaAncla, MetricEvent } from "@boton-ancla/core";

/** Lo que declara una capa en React: lo del núcleo + qué desplaza el ancla (HM-09). */
export type CapaReact = CapaAncla & {
  scrollRef?: RefObject<HTMLElement | null>;
  /** HM-12b (RF-23): la lista de la capa ofrece sus elementos para apuntar y elegir. */
  apuntar?: OpcionesApuntarLista;
};
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OpcionesApuntarLista } from "../types";

// Capas (HM-03, spec RF-15): lo que la app abre ENCIMA del contenido (hojas, listas,
// búsqueda). Mientras haya alguna, el ancla ofrece "Cerrar" a 90°, y el botón atrás
// del sistema cierra la de arriba en vez de navegar.
//
// Historial:
// - Al haber capas se agrega una entrada con marca (history.pushState, soportado por
//   el router de Next 16). "Atrás" dispara popstate y se cierra la capa de arriba.
// - Los cierres propios ("Cerrar" del ancla, Escape, la X de la hoja vía la función que
//   devuelve useAnchorLayer) pasan por history.back(): así la entrada se consume sola.
// - Si la capa desaparece por otro motivo (p. ej. un enlace de la hoja que navega),
//   NUNCA se llama back(): desharía la navegación. Solo se quita la marca; queda una
//   entrada duplicada e inofensiva de la misma página.
// - Se sincroniza en un paso diferido: el doble montaje del Modo estricto de React en
//   desarrollo no lo desordena.

type Capa = {
  clave: symbol;
  onClose: RefObject<() => void>;
  /** Ícono, nombre y acciones de la capa (HM-08); siempre la versión más reciente. */
  datos: RefObject<CapaReact>;
};
export type ViaCierre = "ancla" | "teclado" | "app";

const MARCA = "__botonAnclaCapa";

function entradaPropia(): boolean {
  const estado = window.history.state as Record<string, unknown> | null;
  return Boolean(estado && estado[MARCA]);
}

export type ControlCapas = {
  cantidad: number;
  /** Cambia cuando una capa actualiza su ícono, nombre o acciones (para volver a dibujar). */
  version: number;
  /** Avisa que los datos de alguna capa cambiaron. */
  actualizar: () => void;
  /** Datos de la capa de arriba (la que se ve), o null si no hay capas. */
  datosArriba: () => CapaReact | null;
  agregar: (capa: Capa) => void;
  quitar: (clave: symbol) => void;
  /** Cierra la capa de arriba (por el historial, si tiene su entrada). */
  cerrarArriba: (via: ViaCierre) => void;
  /** Cierra una capa concreta: si es la de arriba, por el historial; si no, directo. */
  cerrar: (clave: symbol) => void;
};

export function useCapas(onEventRef: RefObject<((e: MetricEvent) => void) | undefined>): ControlCapas {
  const pila = useRef<Capa[]>([]);
  const [cantidad, setCantidad] = useState(0);
  const [version, setVersion] = useState(0);
  const actualizar = useCallback(() => setVersion((v) => v + 1), []);
  const datosArriba = useCallback(() => pila.current.at(-1)?.datos.current ?? null, []);
  /** Cierre propio en curso: el próximo popstate lo provocamos nosotros. */
  const cierrePropio = useRef<ViaCierre | null>(null);
  const programado = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sincronizarHistorial = useCallback(() => {
    clearTimeout(programado.current);
    programado.current = setTimeout(() => {
      const hayCapas = pila.current.length > 0;
      const propia = entradaPropia();
      if (hayCapas && !propia) {
        // Se conserva el estado de Next (su árbol de rutas) y se agrega la marca.
        window.history.pushState({ ...(window.history.state ?? {}), [MARCA]: true }, "", window.location.href);
      } else if (!hayCapas && propia) {
        // La capa desapareció sin pasar por el historial: solo se quita la marca.
        const { [MARCA]: _marca, ...resto } = (window.history.state ?? {}) as Record<string, unknown>;
        window.history.replaceState(resto, "", window.location.href);
      }
    }, 0);
  }, []);

  const agregar = useCallback(
    (capa: Capa) => {
      pila.current = [...pila.current, capa];
      setCantidad(pila.current.length);
      sincronizarHistorial();
    },
    [sincronizarHistorial],
  );

  const quitar = useCallback(
    (clave: symbol) => {
      pila.current = pila.current.filter((c) => c.clave !== clave);
      setCantidad(pila.current.length);
      sincronizarHistorial();
    },
    [sincronizarHistorial],
  );

  const registrar = useCallback(
    (via: ViaCierre | "sistema") => {
      if (via === "sistema" || via === "teclado") onEventRef.current?.({ type: "layer_close", via });
    },
    [onEventRef],
  );

  const cerrarArriba = useCallback(
    (via: ViaCierre) => {
      const arriba = pila.current.at(-1);
      if (!arriba) return;
      if (entradaPropia()) {
        cierrePropio.current = via;
        window.history.back(); // el popstate cierra la capa y consume la entrada
      } else {
        arriba.onClose.current?.();
        registrar(via);
      }
    },
    [registrar],
  );

  const cerrar = useCallback(
    (clave: symbol) => {
      const capa = pila.current.find((c) => c.clave === clave);
      if (!capa) return;
      if (pila.current.at(-1) === capa) cerrarArriba("app");
      else capa.onClose.current?.();
    },
    [cerrarArriba],
  );

  useEffect(() => {
    const alVolver = () => {
      const via = cierrePropio.current ?? "sistema";
      cierrePropio.current = null;
      const arriba = pila.current.at(-1);
      if (!arriba) return;
      // Botón atrás del sistema (o un cierre propio): se cierra la capa de arriba, sin navegar.
      arriba.onClose.current?.();
      registrar(via);
      sincronizarHistorial(); // si quedan capas, vuelve a poner la entrada
    };
    window.addEventListener("popstate", alVolver);
    return () => {
      window.removeEventListener("popstate", alVolver);
      clearTimeout(programado.current);
    };
  }, [registrar, sincronizarHistorial]);

  return useMemo(
    () => ({ cantidad, version, actualizar, datosArriba, agregar, quitar, cerrarArriba, cerrar }),
    [cantidad, version, actualizar, datosArriba, agregar, quitar, cerrarArriba, cerrar],
  );
}

"use client";

import type { Rect, Zona } from "@boton-ancla/core";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

// Fase 3 (RF3-10…RF3-13, design.md §5.2): zonas reservadas que declara la app. Se leen al
// dibujar el ancla; un cambio (tamaño, desplazamiento de la ventana, alta o baja) sube una
// versión para que el ancla se recoloque. Mientras hay una interacción, el ancla sigue con la
// geometría del inicio (la de la máquina), así que se recoloca recién al volver a reposo.

export type FuenteZona = RefObject<HTMLElement | null> | Rect;

type Registrada = { fuente: FuenteZona; prioridad: Zona["prioridad"] };

export type RegistroZonas = {
  registrar: (clave: symbol, fuente: FuenteZona, prioridad: Zona["prioridad"]) => void;
  quitar: (clave: symbol) => void;
  /** Las zonas ahora, en coordenadas de la vista (sin las de tamaño cero). */
  leer: () => Zona[];
  /** Sube cuando algo cambió. */
  version: number;
};

function esRef(f: FuenteZona): f is RefObject<HTMLElement | null> {
  return typeof f === "object" && f !== null && "current" in f;
}

export function useZonas(): RegistroZonas {
  const registradas = useRef(new Map<symbol, Registrada>());
  const [version, setVersion] = useState(0);
  const pendiente = useRef(0);
  const observador = useRef<ResizeObserver | null>(null);

  // Varios cambios en el mismo cuadro valen por uno.
  const avisar = useCallback(() => {
    if (pendiente.current) return;
    pendiente.current = requestAnimationFrame(() => {
      pendiente.current = 0;
      setVersion((v) => v + 1);
    });
  }, []);

  // El observador se crea al registrar la primera zona: las zonas de la página se registran en
  // un useLayoutEffect, ANTES que los efectos del proveedor.
  const observar = useCallback(
    (el: HTMLElement) => {
      if (typeof ResizeObserver === "undefined") return;
      observador.current ??= new ResizeObserver(avisar);
      observador.current.observe(el);
    },
    [avisar],
  );

  useEffect(() => {
    window.addEventListener("resize", avisar);
    window.addEventListener("scroll", avisar, { passive: true, capture: true });
    return () => {
      observador.current?.disconnect();
      observador.current = null;
      window.removeEventListener("resize", avisar);
      window.removeEventListener("scroll", avisar, { capture: true });
      cancelAnimationFrame(pendiente.current);
    };
  }, [avisar]);

  const registrar = useCallback(
    (clave: symbol, fuente: FuenteZona, prioridad: Zona["prioridad"]) => {
      registradas.current.set(clave, { fuente, prioridad });
      if (esRef(fuente) && fuente.current) observar(fuente.current);
      avisar();
    },
    [avisar, observar],
  );

  const quitar = useCallback(
    (clave: symbol) => {
      const r = registradas.current.get(clave);
      if (r && esRef(r.fuente) && r.fuente.current) observador.current?.unobserve(r.fuente.current);
      registradas.current.delete(clave);
      avisar();
    },
    [avisar],
  );

  const leer = useCallback((): Zona[] => {
    const zonas: Zona[] = [];
    for (const { fuente, prioridad } of registradas.current.values()) {
      let rect: Rect | null = null;
      if (esRef(fuente)) {
        const b = fuente.current?.getBoundingClientRect();
        if (b) rect = { x: b.left, y: b.top, width: b.width, height: b.height };
      } else rect = fuente;
      if (rect && rect.width > 0 && rect.height > 0) zonas.push({ rect, prioridad });
    }
    return zonas;
  }, []);

  return useMemo(() => ({ registrar, quitar, leer, version }), [registrar, quitar, leer, version]);
}

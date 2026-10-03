"use client";

import type { Insets, Rect } from "@boton-ancla/core";
import { useEffect, useState } from "react";

export type Medidas = { viewport: Rect; safeArea: Insets };

function leerArea(sonda: HTMLElement): Insets {
  const cs = getComputedStyle(sonda);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

/**
 * Tamaño de la ventana y área segura (L-03). JavaScript no puede leer env()
 * directamente: se crea un elemento invisible con padding env(safe-area-inset-*)
 * y se lee su padding calculado. null hasta montar en el navegador.
 */
export function useMedidas(): Medidas | null {
  const [medidas, setMedidas] = useState<Medidas | null>(null);

  useEffect(() => {
    const sonda = document.createElement("div");
    sonda.setAttribute("aria-hidden", "true");
    Object.assign(sonda.style, {
      position: "fixed",
      top: "0",
      left: "0",
      visibility: "hidden",
      pointerEvents: "none",
      paddingTop: "env(safe-area-inset-top)",
      paddingRight: "env(safe-area-inset-right)",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)",
    });
    document.body.appendChild(sonda);

    const actualizar = () =>
      setMedidas({
        viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        safeArea: leerArea(sonda),
      });
    actualizar();
    window.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("resize", actualizar);
    return () => {
      window.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("resize", actualizar);
      sonda.remove();
    };
  }, []);

  return medidas;
}

"use client";

import { useEffect, useState } from "react";

const TIPOS_SIN_TECLADO = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);

function esCampoConTeclado(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !TIPOS_SIN_TECLADO.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * ¿Está abierto el teclado en pantalla? (Etapa 1b: con el teclado abierto la
 * columna de navegación se reduce a un solo botón). El navegador no lo dice
 * directo; se toman dos señales: en táctil, un campo de texto con el foco, y
 * el alto visible (visualViewport) que se encoge más de 150 px.
 */
export function useKeyboardOpen(): boolean {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const tactil = window.matchMedia("(pointer: coarse)");
    const vv = window.visualViewport;
    const revisar = () => {
      const encogido = vv ? window.innerHeight - vv.height > 150 : false;
      setAbierto(encogido || (tactil.matches && esCampoConTeclado(document.activeElement)));
    };
    // Al salir de un campo, el foco todavía no llegó al siguiente elemento.
    const alSalir = () => setTimeout(revisar, 0);
    document.addEventListener("focusin", revisar);
    document.addEventListener("focusout", alSalir);
    vv?.addEventListener("resize", revisar);
    return () => {
      document.removeEventListener("focusin", revisar);
      document.removeEventListener("focusout", alSalir);
      vv?.removeEventListener("resize", revisar);
    };
  }, []);

  return abierto;
}

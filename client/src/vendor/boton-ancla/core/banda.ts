import { distancia } from "./geometry";
import type { FanLayout } from "./layout";
import type { AnchorState } from "./machine/states";
import type { Params } from "./params";
import type { AnchorScreen, Hand, Insets, Point, Rect } from "./types";
import { ID_ATRAS, ID_CERRAR, ID_DESHACER, ID_OCULTAR_TECLADO } from "./validate";

// Banda de etiqueta (HM-02, spec RF-06b, design.md §4.6): una sola etiqueta,
// en una franja fija encima del abanico, fuera del alcance del pulgar.

export const PISTA_BIENVENIDA = "Desliza hacia una opción";

export type PosicionBanda = {
  /** Centro horizontal deseado (el adaptador lo corre para que no se salga). */
  x: number;
  /** Borde de ABAJO de la banda. */
  yBase: number;
  /** Límites horizontales de la zona útil. */
  izquierda: number;
  derecha: number;
};

export function posicionBanda(input: {
  anchor: Point;
  layout: Pick<FanLayout, "radio">;
  viewport: Rect;
  safeArea: Insets;
  hand: Hand;
  params: Params;
  /** Fase 3 (RF3-15): con el abanico hacia abajo, la banda va debajo del abanico. */
  abreHacia?: "arriba" | "abajo";
}): PosicionBanda {
  const { anchor, layout, viewport, safeArea, hand, params, abreHacia = "arriba" } = input;
  // Centro del arco: a medio radio hacia el lado lateral (izquierda con la mano derecha).
  const lateral = hand === "right" ? -1 : 1;
  return {
    x: anchor.x + (lateral * layout.radio) / 2,
    // yBase es el borde de abajo de la banda (la banda ocupa de yBase − BANDA_ALTO a yBase).
    yBase:
      abreHacia === "abajo"
        ? anchor.y + layout.radio + (params.D_OPCION * params.ESCALA_PRESEL) / 2 + params.BANDA_MARGEN + params.BANDA_ALTO
        : anchor.y - layout.radio - (params.D_OPCION * params.ESCALA_PRESEL) / 2 - params.BANDA_MARGEN,
    izquierda: viewport.x + safeArea.left + params.MARGEN_LATERAL,
    derecha: viewport.x + viewport.width - safeArea.right - params.MARGEN_LATERAL,
  };
}

export type TextoBanda = {
  texto: string;
  /** opcion = nombre de una opción; seccion = dónde estás (D-09); pista = bienvenida (HU-12). */
  tipo: "opcion" | "seccion" | "pista";
};

/** Etiqueta visible de una opción del abanico, incluidas las fijas. */
export function etiquetaOpcion(screen: AnchorScreen, id: string): string {
  if (id === ID_ATRAS) return "Atrás";
  if (id === ID_DESHACER) return "Deshacer";
  if (id === ID_CERRAR) return "Cerrar";
  if (id === ID_OCULTAR_TECLADO) return "Ocultar teclado";
  return screen.actions.find((a) => a.id === id)?.label ?? id;
}

/**
 * Qué dice la banda. null cuando el menú no está abierto.
 * `bienvenida`: alguna opción de la pantalla todavía está en sus primeros usos (HU-12).
 */
export function textoBanda(input: { estado: AnchorState; screen: AnchorScreen; bienvenida: boolean }): TextoBanda | null {
  const { estado, screen, bienvenida } = input;

  const deOpcion = (id: string, sufijo = ""): TextoBanda => {
    const slot = "geo" in estado ? estado.geo.slots.find((s) => s.id === id) : undefined;
    const base = etiquetaOpcion(screen, id);
    const noDisponible = slot?.disabled ? " · no disponible" : ""; // C-09
    return { texto: `${base}${noDisponible}${slot?.disabled ? "" : sufijo}`, tipo: "opcion" };
  };
  const sinOpcion = (): TextoBanda =>
    bienvenida ? { texto: PISTA_BIENVENIDA, tipo: "pista" } : { texto: screen.sectionLabel, tipo: "seccion" };

  switch (estado.tipo) {
    case "abierto_gesto": {
      if (!estado.presel) return sinOpcion();
      const slot = estado.geo.slots.find((s) => s.id === estado.presel);
      return deOpcion(estado.presel, slot?.kind === "irreversible" ? " · desliza más allá para confirmar" : "");
    }
    case "confirmacion_armada":
      return deOpcion(estado.presel, " · suelta para confirmar");
    case "abierto_toque":
      // HM-02: al apoyar el dedo sobre una opción, su nombre aparece antes de soltar.
      return estado.presion && estado.presion.sobre !== "centro" ? deOpcion(estado.presion.sobre.id) : sinOpcion();
    case "confirmacion_toque":
      return deOpcion(estado.id);
    case "abierto_teclado": {
      const slot = estado.geo.slots[estado.foco];
      return slot ? deOpcion(slot.id) : sinOpcion();
    }
    default:
      return null;
  }
}

/** Radio real de una geometría (todas las opciones están a la misma distancia del centro). */
export function radioDe(centro: Point, slots: { punto: Point }[], params: Params): number {
  const primero = slots[0];
  return primero ? distancia(centro, primero.punto) : params.R_ARCO;
}

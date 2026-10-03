import { layoutParaPantalla, type Slot } from "../layout";
import type { Params } from "../params";
import type { AnchorScreen, Hand, Insets, Point, Rect } from "../types";
import { ID_ATRAS, ID_CERRAR, ID_OCULTAR_TECLADO } from "../validate";

// Tipos de la máquina de estados (spec §3, design.md §3.2).
// La máquina es pura: todo lo que necesita llega dentro de los eventos.

/** Foto de la geometría al empezar la interacción; la máquina la guarda y no depende del DOM. */
export type Geometry = {
  centro: Point;
  /** Posiciones con su acción, en orden de index (0 = arriba). */
  slots: Slot[];
  params: Params;
  hand: Hand;
  /** Id de la acción de prioridad 1: donde empieza el foco con teclado. */
  prioridad1?: string;
  /** Hay algo registrado para desplazar con el ancla (HM-09, RF-18). */
  desplazable?: boolean;
  /** Cómo se desplaza: "vertical" (listas, HM-09) o "libre" (mapa, HM-11, RF-19). */
  modoDesplazar?: ModoDesplazar;
  /** HM-12b (RF-23): la lista ofrece sus elementos para apuntar (y el interruptor está activado). */
  apuntarLista?: boolean;
  /** Fase 3 (RF3-15): hacia dónde se abre el abanico. Con "abajo", el joystick entra hacia arriba. */
  abreHacia?: "arriba" | "abajo";
};

export type ModoDesplazar = "vertical" | "libre";

export function crearGeometria(input: {
  screen: AnchorScreen;
  viewport: Rect;
  safeArea: Insets;
  hand: Hand;
  params: Params;
  deshacer?: boolean;
  capa?: boolean;
  teclado?: boolean;
  /** HM-09: hay algo registrado para desplazar (y el desplazamiento está activado). */
  desplazable?: boolean;
  /** HM-11: "libre" si lo registrado es un mapa. Por defecto "vertical". */
  modoDesplazar?: ModoDesplazar;
  /** HM-12b: la lista ofrece sus elementos para apuntar. */
  apuntarLista?: boolean;
  /** Fase 3: centro del ancla ya resuelto (resolverColocacion). */
  ancla?: Point;
  /** Fase 3 (RF3-15). */
  abreHacia?: "arriba" | "abajo";
}): Geometry {
  const { anchor, ordered, slots } = layoutParaPantalla(input);
  // La prioridad 1 es la primera acción propia (no "Atrás") de orderActions.
  const prioridad1 = ordered.find((a) => ![ID_ATRAS, ID_CERRAR, ID_OCULTAR_TECLADO].includes(a.id))?.id;
  return { centro: anchor, slots, params: input.params, hand: input.hand, prioridad1, desplazable: input.desplazable ?? false, modoDesplazar: input.modoDesplazar ?? "vertical", apuntarLista: input.apuntarLista ?? false, abreHacia: input.abreHacia ?? "arriba" };
}

/** Datos de un dedo apoyado desde que tocó el ancla. */
type ConPuntero = {
  pointerId: number;
  /** Donde bajó el dedo. */
  inicio: Point;
  /** Última posición conocida. */
  ultimo: Point;
  /** Longitud recorrida, para la métrica pathPx. */
  recorridoPx: number;
  /** Momento en que empezó la interacción (para la métrica ms). */
  t0: number;
  geo: Geometry;
};

type Gesto = ConPuntero & {
  /** Momento en que el menú se abrió (para decidir si fue "experto"). */
  tApertura: number;
  /** Cómo empezó: directo desde el ancla, o desde el modo toque presionando el centro. */
  modoApertura: "gesto" | "toque";
  presel?: string;
  /** Desde cuándo el pulgar está QUIETO sobre `presel` (RF-20: esperar sobre un deslizador; HM-17). */
  tPresel?: number;
  /** Dónde empezó esa quietud: moverse más de UMBRAL_MOV desde aquí reinicia la espera. */
  puntoPresel?: Point;
};

/** RF-21 (HM-12a): lo que hay en la mira. */
export type Apuntado = { tipo: "uno"; id: string } | { tipo: "grupo"; ids: string[] };

/** Un dedo apoyado mientras el menú está abierto en modo toque (C-06). */
export type Presion = {
  pointerId: number;
  inicio: Point;
  sobre: "centro" | { id: string };
  /** Se movió más de UMBRAL_MOV en algún momento. */
  movido: boolean;
};

export type ModoEjecucion = "gesto" | "toque" | "teclado";

export type CancelReason =
  | "zona_muerta"
  | "fuera_de_arco"
  | "deshabilitada"
  | "toque_centro"
  | "toque_fuera"
  | "inactividad"
  | "escape"
  | "segundo_dedo"
  | "pointercancel"
  | "orientacion"
  | "cambio_seccion";

export type AnchorState =
  | { tipo: "reposo" }
  | ({ tipo: "armado" } & ConPuntero)
  | ({ tipo: "descanso"; puntoDescanso: Point } & ConPuntero)
  | ({ tipo: "abierto_gesto" } & Gesto)
  /** HM-09: desplazando el contenido con el pulgar, hasta soltar. `origen` = donde empezó el modo. */
  | ({
      tipo: "desplazando";
      origen: Point;
      tInicio: number;
      apuntado?: Apuntado | null;
      /** HM-12b (RF-23): en una lista, "apuntar" al mover el pulgar hacia el centro de la pantalla. */
      submodo?: "desplazar" | "apuntar";
      /** Dónde empezó "apuntar": los pasos se cuentan desde aquí. */
      origenApuntar?: Point;
    } & ConPuntero)
  /**
   * Fase 3 (RF3-01…RF3-04): modo edición. Con dedo, el ancla lo sigue hasta soltar; sin dedo
   * (entró con EDITAR, el botón de Ajustes), espera el próximo toque sobre el ancla.
   */
  | {
      tipo: "editando";
      geo: Geometry;
      t0: number;
      ultimaActividad: number;
      pointerId?: number;
      inicio?: Point;
      ultimo?: Point;
    }
  /** RF-20: ajustando una opción deslizador (Zoom) con el pulgar, hasta soltar. */
  | ({ tipo: "ajustando"; id: string; origen: Point; tInicio: number } & ConPuntero)
  | ({ tipo: "confirmacion_armada"; presel: string } & Gesto)
  | {
      tipo: "abierto_toque";
      geo: Geometry;
      t0: number;
      tApertura: number;
      ultimaActividad: number;
      /** Abierto por lector de pantalla: no se cierra por tiempo (C-12). */
      sinCierrePorTiempo: boolean;
      presion?: Presion;
    }
  | {
      tipo: "confirmacion_toque";
      geo: Geometry;
      id: string;
      t0: number;
      ultimaActividad: number;
      sinCierrePorTiempo: boolean;
      modo: "toque" | "teclado";
    }
  | { tipo: "abierto_teclado"; geo: Geometry; foco: number; t0: number }
  // Transitorios: el adaptador hace el efecto y envía COMPLETADO.
  | { tipo: "ejecutando"; id: string; modo: ModoEjecucion; experto: boolean; ms: number; recorridoPx: number }
  | { tipo: "cancelado"; motivo: CancelReason }
  /** Fase 3 (RF3-03): soltó el ancla en modo edición; el adaptador aplica el imán y la guarda. */
  | { tipo: "soltado"; punto: Point; ms: number }
  /** RF-21: soltó frenado sobre algo en la mira; el adaptador abre su capa. */
  | { tipo: "elegido"; apuntado: Apuntado; ms: number }
  | { tipo: "bloqueado_sensible"; id: string };

export type TipoEstado = AnchorState["tipo"];

export type Tecla =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "Enter"
  | " "
  | "Escape";

export type AnchorEvent =
  | {
      tipo: "POINTER_DOWN";
      pointerId: number;
      punto: Point;
      t: number;
      sobre: "ancla" | { id: string } | "fuera";
      /** Obligatoria al presionar el ancla en reposo. */
      geo?: Geometry;
    }
  | { tipo: "POINTER_MOVE"; pointerId: number; punto: Point; t: number }
  | { tipo: "POINTER_UP"; pointerId: number; punto: Point; t: number; sobre?: "ancla" | { id: string } | "fuera" }
  | { tipo: "POINTER_CANCEL"; pointerId: number }
  | { tipo: "TICK"; t: number }
  | { tipo: "CONFIRMAR"; t: number }
  | { tipo: "ACTIVAR"; t: number; geo: Geometry }
  | { tipo: "TECLA"; tecla: Tecla; t: number; geo?: Geometry }
  | { tipo: "ORIENTACION" }
  | { tipo: "CAMBIO_SECCION" }
  | { tipo: "COMPLETADO" }
  /** Fase 3 (DF3-01): entrar al modo edición sin dedo (el botón "Mover el ancla" de Ajustes). */
  | { tipo: "EDITAR"; t: number; geo: Geometry }
  /** RF-21: el adaptador avisa qué hay en la mira (hit-test en pantalla). */
  | { tipo: "APUNTAR"; apuntado: Apuntado | null };

export const ESTADOS_TRANSITORIOS: readonly TipoEstado[] = ["ejecutando", "cancelado", "bloqueado_sensible", "elegido", "soltado"];

export const REPOSO: AnchorState = Object.freeze({ tipo: "reposo" });

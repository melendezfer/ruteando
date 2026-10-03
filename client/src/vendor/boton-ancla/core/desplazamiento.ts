import type { Params } from "./params";
import { anguloDesde } from "./geometry";
import type { Hand, Point } from "./types";

// HM-09, RF-18: velocidad del desplazamiento según cuánto se alejó el pulgar (en vertical)
// del punto donde empezó el modo. Función pura: el adaptador la aplica cuadro a cuadro.

/**
 * Velocidad en px/s. Positiva = el contenido baja (se ve lo de más abajo), como al
 * deslizar la barra de desplazamiento; negativa = sube.
 * - Dentro de la zona muerta (R_MUERTA_DESPLAZAR): 0.
 * - Después crece con una curva (exponente CURVA_DESPLAZAR): lenta cerca del centro, para leer.
 * - En R_MAX_DESPLAZAR o más allá: la máxima, y se mantiene mientras el dedo siga ahí.
 * - Con movimiento reducido, la máxima es V_MAX_REDUCIDO.
 */
export function velocidadDesplazamiento(dy: number, params: Params, reducido = false): number {
  const v = rapidez(Math.abs(dy), params, reducido);
  return v === 0 ? 0 : Math.sign(dy) * v;
}

/** La curva de RF-18: rapidez (px/s, sin signo) según la distancia al punto de inicio. */
function rapidez(distancia: number, params: Params, reducido: boolean): number {
  if (distancia <= params.R_MUERTA_DESPLAZAR) return 0;
  const recorrido = Math.min(1, (distancia - params.R_MUERTA_DESPLAZAR) / (params.R_MAX_DESPLAZAR - params.R_MUERTA_DESPLAZAR));
  const maxima = reducido ? params.V_MAX_REDUCIDO : params.V_MAX_DESPLAZAR;
  return maxima * recorrido ** params.CURVA_DESPLAZAR;
}

/**
 * HM-11, RF-19: joystick libre (mapa). La misma curva que el vertical, pero con la distancia
 * en 2D; la velocidad apunta hacia donde está el pulgar respecto al inicio (px/s en x e y de
 * pantalla). La vista avanza hacia allí: pulgar a la derecha = ver lo que está a la derecha.
 */
export function velocidadJoystick(dx: number, dy: number, params: Params, reducido = false): { vx: number; vy: number } {
  const distancia = Math.hypot(dx, dy);
  const v = rapidez(distancia, params, reducido);
  if (v === 0) return { vx: 0, vy: 0 };
  return { vx: (v * dx) / distancia, vy: (v * dy) / distancia };
}

/** HM-10, variante "ancla": qué muestra el propio ancla mientras se desplaza. */
export type IndicadorDesplazamiento = {
  /** 1 = el contenido baja (flecha ↓), -1 = sube (flecha ↑), 0 = quieto (zona muerta). */
  direccion: -1 | 0 | 1;
  /** Cuánto se llena el anillo: 0 en la zona muerta, 1 a la velocidad máxima. */
  llenado: number;
};

export function indicadorDesplazamiento(dy: number, params: Params): IndicadorDesplazamiento {
  const v = velocidadDesplazamiento(dy, params);
  return { direccion: v > 0 ? 1 : v < 0 ? -1 : 0, llenado: Math.abs(v) / params.V_MAX_DESPLAZAR };
}

/**
 * HM-10, variante "arriba": dónde va la cápsula. Arriba del ancla, corrida GUIA_CORRIMIENTO
 * hacia el centro de la pantalla, y con su borde de abajo GUIA_SEPARACION por encima de lo
 * más alto que llega el pulgar (el ancla, o R_MAX_DESPLAZAR sobre el inicio): así el pulgar
 * no la tapa al subir. Si no cabe entera, se achica en vez de bajar hacia el dedo.
 */
export function posicionGuiaArriba(opciones: {
  centro: Point;
  origen: Point;
  hand: Hand;
  params: Params;
  /** Alto deseado de la cápsula, en px. */
  alto: number;
  /** Primer y visible (área segura de arriba), en px. */
  techo: number;
}): { x: number; top: number; alto: number } {
  const { centro, origen, hand, params, alto, techo } = opciones;
  const x = centro.x + (hand === "right" ? -1 : 1) * params.GUIA_CORRIMIENTO;
  const alcance = Math.min(centro.y - params.D_ACTIVO / 2, origen.y - params.R_MAX_DESPLAZAR);
  const fondo = alcance - params.GUIA_SEPARACION;
  const top = Math.max(techo, fondo - alto);
  return { x, top, alto: Math.max(0, fondo - top) };
}

/** HM-11: qué muestra la guía en el joystick libre. */
export type IndicadorJoystick = {
  /** Dirección del pulgar en grados de pantalla (90 = arriba, convención de geometry.ts); null en la zona muerta. */
  angulo: number | null;
  /** Cuánto se llena el anillo: 0 en la zona muerta, 1 a la velocidad máxima. */
  llenado: number;
};

export function indicadorJoystick(dx: number, dy: number, params: Params): IndicadorJoystick {
  const v = rapidez(Math.hypot(dx, dy), params, false);
  if (v === 0) return { angulo: null, llenado: 0 };
  return { angulo: anguloDesde({ x: 0, y: 0 }, { x: dx, y: dy }), llenado: v / params.V_MAX_DESPLAZAR };
}

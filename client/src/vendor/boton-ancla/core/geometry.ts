import type { Hand, Point } from "./types";

// Convención de ángulos (design.md §4.1): grados, 0° = derecha, 90° = arriba,
// 180° = izquierda, con el eje y hacia ARRIBA aunque en pantalla crezca hacia abajo.
// Todo el abanico se calcula en "espacio de mano derecha"; la mano izquierda
// se obtiene reflejando (θ' = 180° − θ), así hay una sola implementación.

const RAD = Math.PI / 180;

/** Lleva cualquier ángulo al rango [0, 360). */
export function normalizarAngulo(grados: number): number {
  const r = grados % 360;
  return r < 0 ? r + 360 : r;
}

export function distancia(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Ángulo de `p` visto desde `centro`, en [0, 360). */
export function anguloDesde(centro: Point, p: Point): number {
  // centro.y − p.y invierte el eje y de la pantalla para que 90° sea "arriba".
  return normalizarAngulo(Math.atan2(centro.y - p.y, p.x - centro.x) / RAD);
}

/** Espejo respecto al eje vertical: derecha ↔ izquierda; arriba y abajo no cambian. */
export function reflejarAngulo(grados: number): number {
  return normalizarAngulo(180 - grados);
}

/**
 * Convierte entre el ángulo real en pantalla y el "espacio de mano derecha".
 * Reflejar dos veces deja el ángulo igual, así que sirve en los dos sentidos.
 */
export function anguloParaMano(grados: number, hand: Hand): number {
  return hand === "right" ? normalizarAngulo(grados) : reflejarAngulo(grados);
}

/** Punto a `radio` px de `centro` en la dirección `grados` (convención de arriba). */
export function puntoEnDireccion(centro: Point, radio: number, grados: number): Point {
  return {
    x: centro.x + radio * Math.cos(grados * RAD),
    y: centro.y - radio * Math.sin(grados * RAD),
  };
}

/** Radio al que dos puntos separados `grados` quedan a `cuerda` px entre sí. */
export function radioParaCuerda(cuerda: number, grados: number): number {
  return cuerda / (2 * Math.sin((grados * RAD) / 2));
}

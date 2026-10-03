import { anguloDesde, distancia } from "./geometry";
import { anguloBaseDe } from "./layout";
import type { Slot } from "./layout";
import type { Params } from "./params";
import type { Hand, Point } from "./types";

// Qué opción está preseleccionada según dónde está el dedo (design.md §4.5).

export type Seleccion = {
  /** Id preseleccionado; undefined en la zona muerta, fuera del arco o sin opciones. */
  id?: string;
  /** El dedo pasó el anillo exterior (R_EXTERIOR), para confirmar irreversibles (RF-07). */
  beyondOuter: boolean;
  /** Distancia del dedo al centro, en px. */
  distancia: number;
  /** Ángulo real del dedo en pantalla, en grados. */
  angulo: number;
};

type EntradaSeleccion = {
  center: Point;
  pointer: Point;
  slots: Slot[];
  /** Preselección anterior, para la histéresis (RF-04). */
  previous?: string;
  hand: Hand;
  params: Params;
  /** Fase 3 (RF3-15): el abanico abre hacia abajo (espejo vertical). */
  abreHacia?: "arriba" | "abajo";
};

export function resolveSelection({ center, pointer, slots, previous, hand, params, abreHacia = "arriba" }: EntradaSeleccion): Seleccion {
  const r = distancia(center, pointer);
  const angulo = anguloDesde(center, pointer);
  const primero = slots[0];
  const ultimo = slots.at(-1);

  // Todas las opciones están a la misma distancia del centro: ese es el radio.
  const rExterior = primero ? distancia(center, primero.punto) + params.EXTRA_EXTERIOR : Number.POSITIVE_INFINITY;
  const base = { beyondOuter: r > rExterior, distancia: r, angulo };

  // 1. Zona muerta: nunca hay preselección, ni siquiera por histéresis (RF-02).
  if (!primero || !ultimo || r < params.R_MUERTA) return base;

  // 2. Fuera del arco, incluida la tolerancia de los extremos: nada (RF-05, C-08).
  const a = anguloBaseDe(angulo, hand, abreHacia);
  if (a < primero.sector.desde || a > ultimo.sector.hasta) return base;

  // 3. Histéresis: la anterior se mantiene hasta pasar HISTERESIS grados su borde (RF-04).
  const anterior = previous === undefined ? undefined : slots.find((s) => s.id === previous);
  if (anterior && a >= anterior.sector.desde - params.HISTERESIS && a <= anterior.sector.hasta + params.HISTERESIS) {
    return { ...base, id: anterior.id };
  }

  // 4. El sector que contiene el ángulo (RF-03). Cada borde pertenece al sector siguiente.
  const elegido = slots.find((s) => a >= s.sector.desde && (a < s.sector.hasta || s === ultimo));
  return { ...base, id: elegido?.id };
}

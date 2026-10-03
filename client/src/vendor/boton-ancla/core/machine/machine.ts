import { DEFAULT_PARAMS, type Params } from "../params";
import { proximoPlazo } from "./deadline";
import { REPOSO, type AnchorEvent, type AnchorState } from "./states";
import { transition } from "./transition";

// Envoltorio con estado alrededor de la función pura `transition` (spec §7).
// Guarda el estado actual y avisa a quien se suscriba; no toca el DOM ni el reloj.

export type Listener = (next: AnchorState, prev: AnchorState, evento: AnchorEvent) => void;

export type Machine = {
  getState(): AnchorState;
  /** Aplica el evento; si el estado cambia, avisa a los suscriptores. Devuelve el estado nuevo. */
  send(evento: AnchorEvent): AnchorState;
  /** Devuelve una función para darse de baja. */
  subscribe(listener: Listener): () => void;
  /** Cuándo enviar el próximo TICK (ver proximoPlazo). */
  nextDeadline(): number | undefined;
  /** Parámetros finales (los por defecto más los que se pasaron). */
  params: Readonly<Params>;
};

export function createAnchorMachine(params: Partial<Params> = {}): Machine {
  const finales: Readonly<Params> = Object.freeze({ ...DEFAULT_PARAMS, ...params });
  let estado: AnchorState = REPOSO;
  const listeners = new Set<Listener>();

  return {
    params: finales,
    getState: () => estado,
    send(evento) {
      const prev = estado;
      const next = transition(prev, evento);
      if (next !== prev) {
        estado = next;
        // Copia: un listener puede darse de baja mientras se recorre.
        for (const l of [...listeners]) l(next, prev, evento);
      }
      return estado;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    nextDeadline: () => proximoPlazo(estado),
  };
}

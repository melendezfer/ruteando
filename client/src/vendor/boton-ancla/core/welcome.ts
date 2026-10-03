import type { Params } from "./params";

// Bienvenida de los primeros usos (spec HU-12, C-17). Lógica pura: el adaptador
// guarda el texto de serializarBienvenida en localStorage y lo lee con leerBienvenida.

export type EstadoBienvenida = {
  version: 1;
  /** La demostración inicial (una opción sale y vuelve) ya se mostró. */
  demostracionHecha: boolean;
  /** Veces que se EJECUTÓ cada opción, por id de acción (C-17: uso = ejecución). */
  usos: Record<string, number>;
  /** Fase 3 (H13, RF3-14): ya se preguntó con qué mano se usa el teléfono. Solo aparece en true. */
  manoPreguntada?: true;
};

export const BIENVENIDA_INICIAL: EstadoBienvenida = Object.freeze({
  version: 1,
  demostracionHecha: false,
  usos: Object.freeze({}) as Record<string, number>,
});

export function necesitaDemostracion(estado: EstadoBienvenida): boolean {
  return !estado.demostracionHecha;
}

/**
 * Fase 3 (H13, RF3-14): la bienvenida pregunta la mano solo la primera vez (antes de la
 * demostración). Quien ya hizo la bienvenida no vuelve a verla (no se interrumpe a nadie).
 */
export function necesitaPreguntarMano(estado: EstadoBienvenida): boolean {
  return !estado.demostracionHecha && !estado.manoPreguntada;
}

export function marcarMano(estado: EstadoBienvenida): EstadoBienvenida {
  return { ...estado, manoPreguntada: true };
}

export function marcarDemostracion(estado: EstadoBienvenida): EstadoBienvenida {
  return { ...estado, demostracionHecha: true };
}

/**
 * La etiqueta se muestra durante los primeros USOS_ETIQUETA usos de la opción:
 * con 0 a 4 ejecuciones previas se ve; desde la 5.ª ejecución ya no.
 */
export function mostrarEtiqueta(estado: EstadoBienvenida, idAccion: string, params: Params): boolean {
  return (estado.usos[idAccion] ?? 0) < params.USOS_ETIQUETA;
}

/** Suma un uso a la opción ejecutada. Devuelve un estado nuevo. */
export function registrarUso(estado: EstadoBienvenida, idAccion: string): EstadoBienvenida {
  return { ...estado, usos: { ...estado.usos, [idAccion]: (estado.usos[idAccion] ?? 0) + 1 } };
}

export function serializarBienvenida(estado: EstadoBienvenida): string {
  return JSON.stringify(estado);
}

/**
 * Lee lo guardado. Ante cualquier dato ausente, dañado o de otra versión vuelve
 * al estado inicial en lugar de fallar: la bienvenida nunca debe romper el ancla.
 */
export function leerBienvenida(texto: string | null | undefined): EstadoBienvenida {
  if (!texto) return BIENVENIDA_INICIAL;
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    return BIENVENIDA_INICIAL;
  }
  if (typeof dato !== "object" || dato === null) return BIENVENIDA_INICIAL;
  const d = dato as Partial<EstadoBienvenida>;
  if (d.version !== 1) return BIENVENIDA_INICIAL;

  const usos: Record<string, number> = {};
  if (typeof d.usos === "object" && d.usos !== null) {
    for (const [id, n] of Object.entries(d.usos)) {
      if (typeof n === "number" && Number.isInteger(n) && n >= 0) usos[id] = n;
    }
  }
  return { version: 1, demostracionHecha: d.demostracionHecha === true, usos, ...(d.manoPreguntada === true ? { manoPreguntada: true as const } : {}) };
}

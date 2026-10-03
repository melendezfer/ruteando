"use client";

import { useSyncExternalStore } from "react";
import type { PrefsAncla } from "@boton-ancla/core";

/**
 * Botón-ancla, etapa I1 (docs/integracion-ancla.md §0 y §1):
 * - bandera de compilación `NEXT_PUBLIC_ANCLA=1` (en producción empieza
 *   apagado: sin la bandera, ni siquiera aparece la opción en Ajustes);
 * - modo elegido por la persona en Cuenta → Configuración, por dispositivo
 *   (es una preferencia de cómo usa SU celular, no un dato de la cuenta):
 *   Completo (menú, joystick, apuntar y elegir), Solo menú, Apagado.
 * Apagado es el valor por defecto: RUTEANDO se ve y funciona igual que antes.
 */
export const ANCLA_HABILITADA = process.env.NEXT_PUBLIC_ANCLA === "1";

export type ModoAncla = "completo" | "solo-menu" | "apagado";

const CLAVE_MODO = "ruteando.ancla.modo";
const CLAVE_COLOCACION = "ruteando.ancla.colocacion";
const MODOS: ModoAncla[] = ["completo", "solo-menu", "apagado"];

const oyentes = new Set<() => void>();
function avisar() {
  oyentes.forEach((f) => f());
}
function suscribir(f: () => void) {
  oyentes.add(f);
  const alCambiarOtraPestana = (e: StorageEvent) => {
    if (e.key === CLAVE_MODO || e.key === CLAVE_COLOCACION) f();
  };
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => {
    oyentes.delete(f);
    window.removeEventListener("storage", alCambiarOtraPestana);
  };
}

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function leerModo(): ModoAncla {
  const v = leer(CLAVE_MODO);
  return MODOS.includes(v as ModoAncla) ? (v as ModoAncla) : "apagado";
}

export function guardarModo(modo: ModoAncla) {
  try {
    window.localStorage.setItem(CLAVE_MODO, modo);
  } catch {
    // Sin almacenamiento: queda en el valor por defecto (apagado).
  }
  avisar();
}

/** Modo vigente; "apagado" en el servidor y sin la bandera. */
export function useModoAncla(): ModoAncla {
  const modo = useSyncExternalStore(suscribir, leerModo, () => "apagado" as const);
  return ANCLA_HABILITADA ? modo : "apagado";
}

// Colocación (Fase 3 del ancla: lado y altura por orientación). Se guarda el
// texto tal cual y se parsea con caché para que useSyncExternalStore reciba
// siempre el mismo objeto mientras no cambie.
let colocacionCache: { texto: string | null; valor: PrefsAncla | null } = { texto: null, valor: null };
function leerColocacion(): PrefsAncla | null {
  const texto = leer(CLAVE_COLOCACION);
  if (texto !== colocacionCache.texto) {
    let valor: PrefsAncla | null = null;
    try {
      valor = texto ? (JSON.parse(texto) as PrefsAncla) : null;
    } catch {
      valor = null;
    }
    colocacionCache = { texto, valor };
  }
  return colocacionCache.valor;
}

export function guardarColocacion(colocacion: PrefsAncla) {
  try {
    window.localStorage.setItem(CLAVE_COLOCACION, JSON.stringify(colocacion));
  } catch {
    // nada que hacer
  }
  avisar();
}

export function useColocacionAncla(): PrefsAncla | null {
  return useSyncExternalStore(suscribir, leerColocacion, () => null);
}

import type { BusinessDetailsValues } from "@/components/business/registration/details-step";
import type { BusinessLocationValues } from "@/components/business/registration/location-step";
import type { WeekSchedule } from "@/components/business/registration/schedule-step";

/**
 * Borrador del asistente de registro ("Guardar y terminar después", pedido
 * del usuario, 2026-09-29): lo que el vendedor escribió y todavía no se
 * guardó en el servidor. Vive en este navegador, por usuario. Lo que SÍ
 * se guardó (el negocio se crea al terminar el paso 1) se retoma también
 * desde el servidor en otro dispositivo (`/negocios/nuevo?negocio=<id>`).
 */
export type DraftStep = "details" | "location" | "schedule";

export interface RegistrationDraft {
  businessId: string | null;
  step: DraftStep;
  details: BusinessDetailsValues;
  location: BusinessLocationValues;
  schedule: WeekSchedule;
}

const key = (userId: string) => `ruteando.registro.borrador:${userId}`;

export function loadDraft(userId: string): RegistrationDraft | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as RegistrationDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: RegistrationDraft): void {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(draft));
  } catch {
    // Sin almacenamiento: lo guardado en el servidor igual se retoma.
  }
}

export function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // nada que hacer
  }
}

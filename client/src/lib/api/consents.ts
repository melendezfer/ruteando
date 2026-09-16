import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type Consent = components["schemas"]["Consent"];

export type MandatoryConsentType = "data_processing" | "terms_conditions";

export const MANDATORY_CONSENT_TYPES: MandatoryConsentType[] = ["data_processing", "terms_conditions"];

/**
 * Versión del texto legal que se registra junto con cada consentimiento
 * (RF-018) — mismo criterio que el registro asistido de la Épica F5
 * (business-registration-wizard.tsx): todavía no hay una pantalla real
 * de términos versionados (Épica F6), así que se usa un valor fijo hasta
 * que exista.
 */
export const MANDATORY_CONSENT_TEXT_VERSION = "1.0";

export const CONSENT_TYPE_INFO: Record<MandatoryConsentType, { label: string; href: string }> = {
  data_processing: { label: "Tratamiento de datos personales", href: "/legal/tratamiento-datos" },
  terms_conditions: { label: "Términos y condiciones", href: "/legal/terminos-condiciones" },
};

/**
 * POST /consents para los dos tipos obligatorios, ya autenticado — usada
 * justo después de un registro exitoso (RF-018, Ley 1581), cuyo
 * formulario exige el checkbox correspondiente antes de poder enviarse.
 * Best-effort a propósito: si esto falla, la cuenta ya quedó creada y
 * con sesión igual — ConsentRequiredModal (login) es la red de
 * seguridad la próxima vez que login()/refresh() lo exijan.
 */
export async function grantMandatoryConsents(): Promise<void> {
  await Promise.all(
    MANDATORY_CONSENT_TYPES.map((type) =>
      api.POST("/consents", {
        body: { type, textVersion: MANDATORY_CONSENT_TEXT_VERSION, grantedByThirdParty: false },
      }),
    ),
  );
}

/**
 * Fase 4 de "vendiendo ahora" (sin RF asociado — ver CLAUDE.md sección
 * 11/37): `tipo_consentimiento='notifications'` es el único requisito
 * que le faltaba a un vendedor real para que un consumidor pueda
 * preguntarle "¿sigue vendiendo?" (`solicitar()`, backend, ya lo exige
 * desde la sección 11 — 409 sin él). A diferencia de
 * `grantMandatoryConsents`, esto NO es best-effort silencioso: es una
 * acción explícita del vendedor desde Configuración, así que el
 * resultado (éxito o error) sí se le muestra.
 */
export async function grantNotificationsConsent(): Promise<{
  ok: boolean;
  status: number | undefined;
  consent: Consent | null;
}> {
  const { data, response } = await api.POST("/consents", {
    body: { type: "notifications", textVersion: MANDATORY_CONSENT_TEXT_VERSION, grantedByThirdParty: false },
  });
  return { ok: response.ok, status: response.status, consent: data ?? null };
}

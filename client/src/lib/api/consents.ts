import { api } from "@/lib/api/client";

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

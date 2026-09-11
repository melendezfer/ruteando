"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";

type User = components["schemas"]["User"];
type Consent = components["schemas"]["Consent"];

const ROLE_LABELS: Record<NonNullable<User["role"]>, string> = {
  consumer: "Consumidor",
  vendor: "Vendedor",
  administrator: "Administrador",
};

// Los cuatro valores de tipo_consentimiento (CLAUDE.md sección 5) —
// data_processing/terms_conditions son los obligatorios que login()
// exige (ver ConsentRequiredModal); assisted_registration y
// notifications son casos de uso puntuales (registro asistido, Épica
// F5; confirmación de disponibilidad, sección 11) que un usuario
// concreto puede no tener nunca.
const CONSENT_LABELS: Record<NonNullable<Consent["type"]>, string> = {
  data_processing: "Tratamiento de datos personales",
  terms_conditions: "Términos y condiciones",
  assisted_registration: "Registro asistido",
  notifications: "Notificaciones",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

interface SettingsTabProps {
  user: User;
}

/**
 * Datos básicos de la cuenta + estado de los consentimientos ya
 * otorgados (GET /users/me/consents, Épica 8) — de solo lectura: el PR
 * #22 ya resolvió el flujo de OTORGARLOS (registro + ConsentRequiredModal
 * en login), acá solo se muestra el resultado, sin repetir ese modal
 * bloqueante ni ofrecer revocarlos (append-only por diseño, sin
 * endpoint de revocación — CLAUDE.md, Épica 6/8). Tampoco hay edición de
 * nombre/correo/rol todavía: no la pidió esta épica, y agregarla sin que
 * se pidiera sería sobre-construir la pantalla.
 */
export function SettingsTab({ user }: SettingsTabProps) {
  const [consents, setConsents] = useState<Consent[] | null>(null);

  useEffect(() => {
    let ignore = false;
    api.GET("/users/me/consents").then(({ data }) => {
      if (!ignore) setConsents(data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Tu cuenta</h2>
        <dl className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-sans text-body-sm text-text-muted">Nombre</dt>
            <dd className="font-sans text-body text-text">{user.fullName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-sans text-body-sm text-text-muted">Correo</dt>
            <dd className="font-sans text-body text-text">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-sans text-body-sm text-text-muted">Tipo de cuenta</dt>
            <dd className="font-sans text-body text-text">
              {user.role ? (ROLE_LABELS[user.role] ?? user.role) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Consentimientos otorgados</h2>

        {consents === null && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {consents !== null && consents.length === 0 && (
          <p className="font-sans text-body-sm text-text-muted">
            Todavía no tienes ningún consentimiento registrado.
          </p>
        )}

        {consents !== null && consents.length > 0 && (
          <ul className="flex flex-col gap-2">
            {consents.map((consent) => (
              <li key={consent.id} className="flex items-start gap-2">
                <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-verde" />
                <div className="flex flex-col">
                  <span className="font-sans text-body text-text">
                    {consent.type ? (CONSENT_LABELS[consent.type] ?? consent.type) : "Consentimiento"}
                  </span>
                  {consent.grantedAt && (
                    <span className="font-sans text-caption text-text-muted">
                      Otorgado el {DATE_FORMATTER.format(new Date(consent.grantedAt))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

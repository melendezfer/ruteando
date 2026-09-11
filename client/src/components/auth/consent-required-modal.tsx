"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CONSENT_TYPE_INFO, type MandatoryConsentType } from "@/lib/api/consents";

interface ConsentRequiredModalProps {
  missingTypes: MandatoryConsentType[];
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Bug real reportado en producción (2026-09-11, ver CLAUDE.md): una
 * cuenta creada antes de que el registro pidiera este consentimiento (o
 * cualquiera que nunca lo haya otorgado) quedaba bloqueada para siempre
 * en el login — login()/refresh() nunca emiten tokens sin consentimiento
 * (RF-018), y sin tokens no había ninguna pantalla donde otorgarlo. Este
 * modal se abre desde LoginPage justo cuando POST /auth/login devuelve
 * 403 (consent-required): el usuario acepta acá mismo y LoginPage
 * reintenta el mismo login con `consents`, que el backend otorga y usa
 * como prueba de identidad ya verificada (la contraseña) para emitir
 * tokens en la misma llamada — sin un segundo viaje a POST /consents,
 * que de todas formas exige un token que en este estado no existe.
 */
export function ConsentRequiredModal({
  missingTypes,
  submitting,
  error,
  onConfirm,
  onCancel,
}: ConsentRequiredModalProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const allAccepted = missingTypes.every((type) => accepted[type]);

  function toggle(type: MandatoryConsentType) {
    setAccepted((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-card bg-surface p-6 shadow-xl sm:rounded-card">
        <h2 id="consent-modal-title" className="font-heading text-title-1 font-bold text-text">
          Antes de continuar
        </h2>
        <p className="font-sans text-body-sm text-text-muted">
          Tu cuenta todavía no tiene registrado el consentimiento obligatorio para tratar tus datos.
          Acéptalo para poder entrar.
        </p>

        <div className="flex flex-col gap-3">
          {missingTypes.map((type) => {
            const info = CONSENT_TYPE_INFO[type];
            return (
              <label key={type} className="flex items-start gap-2 font-sans text-body text-text">
                <input
                  type="checkbox"
                  required
                  checked={Boolean(accepted[type])}
                  onChange={() => toggle(type)}
                  className="mt-0.5"
                />
                <span>
                  Acepto{" "}
                  <Link
                    href={info.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-terracota underline"
                  >
                    {info.label}
                  </Link>
                </span>
              </label>
            );
          })}
        </div>

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            loading={submitting}
            disabled={!allAccepted}
            className="flex-1"
          >
            Aceptar y entrar
          </Button>
        </div>
      </div>
    </div>
  );
}

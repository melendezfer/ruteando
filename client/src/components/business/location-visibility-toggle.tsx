"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";

interface LocationVisibilityToggleProps {
  businessId: string;
  initialShowExactLocation: boolean;
}

/**
 * "Mostrar mi dirección exacta" vs. "Mostrar solo la zona aproximada"
 * (ver CLAUDE.md) — solo visible para el dueño en su propio perfil de
 * negocio (business-profile-screen.tsx). Cambia de inmediato con cada
 * clic (PATCH /businesses/{businessId}/location/visibility) — "puede
 * cambiarlo cuando quiera" no debería exigir un botón "Guardar" aparte
 * para una preferencia de dos estados.
 */
export function LocationVisibilityToggle({
  businessId,
  initialShowExactLocation,
}: LocationVisibilityToggleProps) {
  const [showExact, setShowExact] = useState(initialShowExactLocation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    if (next === showExact || saving) return;
    setSaving(true);
    setError(null);

    const { response } = await api.PATCH("/businesses/{businessId}/location/visibility", {
      params: { path: { businessId } },
      body: { showExactLocation: next },
    });

    setSaving(false);

    if (!response.ok) {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
      return;
    }

    setShowExact(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <p className="font-sans text-body font-medium text-text">Privacidad de tu ubicación</p>
      <fieldset className="flex flex-col gap-2" disabled={saving}>
        <label className="flex items-start gap-2 font-sans text-body-sm text-text">
          <input
            type="radio"
            name={`showExactLocation-${businessId}`}
            checked={!showExact}
            onChange={() => handleChange(false)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Zona aproximada</span> (recomendado) — en el mapa se muestra tu
            manzana o conjunto, nunca el punto exacto.
          </span>
        </label>
        <label className="flex items-start gap-2 font-sans text-body-sm text-text">
          <input
            type="radio"
            name={`showExactLocation-${businessId}`}
            checked={showExact}
            onChange={() => handleChange(true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Dirección exacta</span> — el mapa muestra el punto exacto que
            registraste.
          </span>
        </label>
      </fieldset>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}

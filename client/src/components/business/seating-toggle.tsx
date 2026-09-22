"use client";

import { useState } from "react";
import { Chair } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";

interface SeatingToggleProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  initialSeatingAvailable: boolean;
}

/**
 * "Tengo bancas/asientos" (petición directa del usuario, sin RF
 * asociado — ver CLAUDE.md) — solo visible para el dueño en su propio
 * perfil de negocio (business-profile-screen.tsx). Mismo patrón exacto
 * que OwnDeliveryToggle: `seatingAvailable` vive en BusinessInput y se
 * cambia con el mismo PATCH /businesses/{businessId} que usa el
 * asistente de registro — este componente manda el resto de los campos
 * actuales del negocio tal cual (name/categoryId obligatorios en
 * BusinessInput; description/contactPhone se conservan) para no
 * pisarlos solo por cambiar este interruptor.
 */
export function SeatingToggle({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  initialSeatingAvailable,
}: SeatingToggleProps) {
  const [seatingAvailable, setSeatingAvailable] = useState(initialSeatingAvailable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    if (next === seatingAvailable || saving) return;
    setSaving(true);
    setError(null);

    const { response } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: {
        name,
        description: description ?? undefined,
        categoryId,
        contactPhone: contactPhone ?? undefined,
        seatingAvailable: next,
      },
    });

    setSaving(false);

    if (!response.ok) {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
      return;
    }

    setSeatingAvailable(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`seatingAvailable-${businessId}`} className="flex items-center gap-2">
          <Chair size={22} weight="duotone" className="text-terracota" />
          <span className="font-sans text-body text-text">Tengo bancas/asientos</span>
        </label>
        <input
          id={`seatingAvailable-${businessId}`}
          type="checkbox"
          role="switch"
          aria-checked={seatingAvailable}
          checked={seatingAvailable}
          disabled={saving}
          onChange={(event) => handleChange(event.target.checked)}
          className="h-5 w-5 accent-terracota"
        />
      </div>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}

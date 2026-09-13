"use client";

import { useState } from "react";
import { Moped } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";

interface OwnDeliveryToggleProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  initialOwnDelivery: boolean;
}

/**
 * "Hago domicilios propios" (petición directa del usuario, sin RF
 * asociado — ver CLAUDE.md) — solo visible para el dueño en su propio
 * perfil de negocio (business-profile-screen.tsx). A diferencia de
 * LocationVisibilityToggle (que tiene su propio endpoint PATCH
 * .../location/visibility, un solo campo), ownDelivery vive en
 * BusinessInput y se cambia con el mismo PATCH /businesses/{businessId}
 * que usa el asistente de registro — así que este componente manda el
 * resto de los campos actuales del negocio tal cual (name/categoryId
 * obligatorios en BusinessInput; description/contactPhone se conservan)
 * para no pisarlos solo por cambiar este interruptor.
 */
export function OwnDeliveryToggle({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  initialOwnDelivery,
}: OwnDeliveryToggleProps) {
  const [ownDelivery, setOwnDelivery] = useState(initialOwnDelivery);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    if (next === ownDelivery || saving) return;
    setSaving(true);
    setError(null);

    const { response } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: {
        name,
        description: description ?? undefined,
        categoryId,
        contactPhone: contactPhone ?? undefined,
        ownDelivery: next,
      },
    });

    setSaving(false);

    if (!response.ok) {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
      return;
    }

    setOwnDelivery(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`ownDelivery-${businessId}`} className="flex items-center gap-2">
          <Moped size={22} weight="duotone" className="text-terracota" />
          <span className="font-sans text-body text-text">Hago domicilios propios</span>
        </label>
        <input
          id={`ownDelivery-${businessId}`}
          type="checkbox"
          role="switch"
          aria-checked={ownDelivery}
          checked={ownDelivery}
          disabled={saving}
          onChange={(event) => handleChange(event.target.checked)}
          className="h-5 w-5 accent-terracota"
        />
      </div>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}

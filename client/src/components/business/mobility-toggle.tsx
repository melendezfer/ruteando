"use client";

import { useState } from "react";
import { ShoppingCartSimple, Storefront } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type Mobility = NonNullable<components["schemas"]["Business"]["mobility"]>;

interface MobilityToggleProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  initialMobility: Mobility;
}

const OPTIONS: { value: Mobility; label: string; icon: typeof ShoppingCartSimple }[] = [
  { value: "itinerant", label: "Ambulante", icon: ShoppingCartSimple },
  { value: "fixed", label: "Local fijo", icon: Storefront },
];

/**
 * "¿Tu negocio es ambulante o de local fijo?" (petición directa del
 * usuario, sin RF asociado — ver CLAUDE.md) — solo visible para el
 * dueño en su propio perfil de negocio. Mismo patrón exacto que
 * OwnDeliveryToggle/HygieneBadgeToggle: cambia con el mismo
 * PATCH /businesses/{businessId} que usa el asistente de registro,
 * mandando el resto de los campos actuales tal cual para no pisarlos
 * solo por cambiar este interruptor.
 *
 * Segmentado (dos botones), no un checkbox — a diferencia de
 * ownDelivery/hygieneSelfDeclared (activar/desactivar UNA
 * característica), esto es una elección entre dos estados excluyentes,
 * ninguno "apagado" por defecto.
 *
 * El mapa (leaflet-map.tsx) usa este mismo campo para la FORMA del pin
 * (carrito vs. gota clásica) — el color sigue viniendo únicamente de
 * la categoría, ver category-pin-colors.ts.
 */
export function MobilityToggle({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  initialMobility,
}: MobilityToggleProps) {
  const [mobility, setMobility] = useState<Mobility>(initialMobility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: Mobility) {
    if (next === mobility || saving) return;
    setSaving(true);
    setError(null);

    const { response } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: {
        name,
        description: description ?? undefined,
        categoryId,
        contactPhone: contactPhone ?? undefined,
        mobility: next,
      },
    });

    setSaving(false);

    if (!response.ok) {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
      return;
    }

    setMobility(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <span className="font-sans text-body text-text">¿Cómo es tu negocio?</span>
      <div className="flex gap-2" role="radiogroup" aria-label="Movilidad del negocio">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mobility === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => handleChange(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-input border px-3 py-2 font-sans text-body-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-terracota bg-terracota text-white"
                  : "border-border bg-background text-text hover:bg-surface"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {label}
            </button>
          );
        })}
      </div>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}

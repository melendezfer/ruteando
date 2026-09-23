"use client";

import { useState } from "react";
import { MOBILITY_ICONS, MOBILITY_LABELS } from "@/lib/icons/semantic-icons";
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
  /** Avisa al perfil tras guardar — los paneles de ambulante (ubicación en vivo, puntos por hora) solo se muestran en esa modalidad. */
  onChange?: (mobility: Mobility) => void;
}

// 3 modalidades (migración modalidad-fijo-via-publica) — íconos y textos
// desde el registro único (lib/icons/semantic-icons.ts), los mismos que
// usa la marca de modalidad del pin del mapa.
const OPTIONS = (["itinerant", "street_stall", "fixed"] as const).map((value) => ({
  value,
  label: MOBILITY_LABELS[value],
  icon: MOBILITY_ICONS[value],
}));

/**
 * "¿Tu negocio es ambulante, un puesto en la calle o un local?" (petición directa del
 * usuario, sin RF asociado — ver CLAUDE.md) — solo visible para el
 * dueño en su propio perfil de negocio. Mismo patrón exacto que
 * OwnDeliveryToggle/HygieneBadgeToggle: cambia con el mismo
 * PATCH /businesses/{businessId} que usa el asistente de registro,
 * mandando el resto de los campos actuales tal cual para no pisarlos
 * solo por cambiar este interruptor.
 *
 * Segmentado (tres botones), no un checkbox — a diferencia de
 * ownDelivery/hygieneSelfDeclared (activar/desactivar UNA
 * característica), esto es una elección entre estados excluyentes,
 * ninguno "apagado" por defecto.
 *
 * El mapa usa este mismo campo para la marca de modalidad del pin; el
 * ícono y el color del pin vienen de la categoría.
 */
export function MobilityToggle({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  initialMobility,
  onChange,
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
    onChange?.(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <span className="font-sans text-body text-text">¿Cómo es tu negocio?</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modalidad del negocio">
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
              className={`flex flex-col items-center justify-center gap-1 rounded-input border px-2 py-2 text-center font-sans text-caption font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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

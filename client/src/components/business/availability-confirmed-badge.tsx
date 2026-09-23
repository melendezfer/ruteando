import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

// "Confirmó que está vendiendo" — ícono propio (registro único), distinto
// de "abierto según su horario" y de "acción completada".
const ConfirmedSellingIcon = SEMANTIC_ICONS.confirmedSelling;
import { formatConfirmedAgo } from "@/lib/availability/format-confirmed-at";

interface AvailabilityConfirmedBadgeProps {
  confirmedAt: string | null | undefined;
}

/**
 * "Confirmado hace X" — Fase 2 de "vendiendo ahora" (sin RF asociado,
 * ver CLAUDE.md sección 37). Puramente informativo (decisión B, del
 * usuario): se muestra igual sin importar `mobility`, y no reemplaza ni
 * condiciona el badge "Abierto ahora" (ese es horario declarado; este es
 * una confirmación real y reciente del vendedor). Visible para
 * cualquiera — `availabilityConfirmedAt` no es un dato exclusivo del
 * dueño (a diferencia de `rejectionReason`).
 */
export function AvailabilityConfirmedBadge({ confirmedAt }: AvailabilityConfirmedBadgeProps) {
  if (!confirmedAt) return null;

  return (
    // suppressHydrationWarning: "confirmado hace X" depende del reloj y el
    // perfil se renderiza también en el servidor (ver product-row.tsx).
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-verde/10 px-3 py-1 font-sans text-caption font-semibold text-verde"
      suppressHydrationWarning
    >
      <ConfirmedSellingIcon size={16} weight="bold" />
      {formatConfirmedAgo(confirmedAt)}
    </span>
  );
}

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
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
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-verde/10 px-3 py-1 font-sans text-caption font-semibold text-verde">
      <CheckCircle size={16} weight="bold" />
      {formatConfirmedAgo(confirmedAt)}
    </span>
  );
}

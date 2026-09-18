import type { BusinessPin } from "@/components/map/leaflet-map";

/**
 * Orden del banner "Disponibles ahora" (Fase 1 del banner de
 * descubrimiento, sin RF asociado — petición directa del usuario):
 * distancia ascendente primero; entre negocios a la misma distancia
 * (o sin `distanceMeters`, sin geolocalización concedida), prioriza los
 * que tienen una confirmación de disponibilidad fresca
 * (`availabilityConfirmedAt`, sección 37 de CLAUDE.md) sobre los que
 * solo cumplen `openNow` por horario declarado — "🟢 Vendiendo ahora"
 * antes que "🟢 Abierto". No es el algoritmo definitivo, solo un
 * criterio simple para esta fase.
 */
export function sortAvailableNow(businesses: BusinessPin[]): BusinessPin[] {
  return [...businesses].sort((a, b) => {
    const distanceA = a.distanceMeters ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (distanceA !== distanceB) return distanceA - distanceB;

    const confirmedA = a.availabilityConfirmedAt ? 0 : 1;
    const confirmedB = b.availabilityConfirmedAt ? 0 : 1;
    return confirmedA - confirmedB;
  });
}

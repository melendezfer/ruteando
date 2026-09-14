/**
 * "Zonas de aglomeración" (ver CLAUDE.md sección 32, sin RF asociado) —
 * formato compartido entre el mapa (zone-circle) y la tarjeta de
 * comparación (zone-comparison-card), para que ambos hablen de la
 * "variedad" de una zona con el mismo criterio de texto.
 */

/**
 * Velocidad de caminata asumida para convertir distancia a minutos —
 * cifra propia, no citada de ningún documento. ~4.8 km/h es un promedio
 * habitual para caminata urbana casual (no una carrera contra el
 * tiempo); coherente con el radio de las zonas mismas (200m, pensado
 * como "un par de cuadras caminables").
 */
export const WALKING_SPEED_METERS_PER_MINUTE = 80;

export function estimateWalkingMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round(distanceMeters / WALKING_SPEED_METERS_PER_MINUTE));
}

export function describeVariety(categoryCount: number): string {
  if (categoryCount <= 1) return "1 tipo de comercio";
  return `${categoryCount} tipos de comercio distintos`;
}

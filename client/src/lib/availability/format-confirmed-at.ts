/**
 * "Confirmado hace X" (Fase 2 de "vendiendo ahora", sin RF asociado —
 * ver CLAUDE.md sección 11/37). `availabilityConfirmedAt` solo llega
 * no-null cuando el backend ya lo consideró "fresco" (dentro de
 * AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES, 60 min por ahora) — en la
 * práctica nunca vamos a necesitar mostrar horas, pero la función no
 * asume ese límite: si el valor configurado del lado del servidor
 * cambiara, este texto sigue siendo correcto sin tocar nada acá.
 */
export function formatConfirmedAgo(confirmedAt: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(confirmedAt).getTime()) / 60000));

  if (minutos < 1) return "Confirmado hace instantes";
  if (minutos === 1) return "Confirmado hace 1 min";
  if (minutos < 60) return `Confirmado hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  return horas === 1 ? "Confirmado hace 1 h" : `Confirmado hace ${horas} h`;
}

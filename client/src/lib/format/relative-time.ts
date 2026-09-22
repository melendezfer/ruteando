/**
 * "hace X" genérico — sin RF asociado, petición directa del usuario (ver
 * CLAUDE.md): a diferencia de `formatConfirmedAgo`/`formatAskedAgo`
 * (lib/availability/format-confirmed-at.ts, acotados a minutos/horas
 * porque sus datos de origen expiran rápido — 60 min, 10 min), esto
 * necesita cubrir también días: un producto puede quedar "disponible" o
 * "no disponible" durante semanas sin que nadie lo vuelva a tocar.
 */
export function formatRelativeTimeShort(iso: string, now: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));

  if (minutos < 1) return "hace instantes";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return horas === 1 ? "hace 1 h" : `hace ${horas} h`;

  const dias = Math.round(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

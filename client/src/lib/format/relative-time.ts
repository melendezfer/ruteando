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

const HORA_BOGOTA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const FECHA_BOGOTA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

/**
 * A7 (fix/pulido-visual): la hora ("11:00 a. m.") en que ocurrió `iso`, solo
 * si fue HOY en Bogotá; `null` si fue otro día. Así la fila del producto
 * dice "Agotado desde las 11:00 a. m." cuando es un dato de hoy, y solo
 * "Agotado" cuando es viejo (un "hace 5 días" no le sirve a nadie).
 */
export function formatTimeIfToday(iso: string, now: Date = new Date()): string | null {
  const fecha = new Date(iso);
  if (FECHA_BOGOTA.format(fecha) !== FECHA_BOGOTA.format(now)) return null;
  return HORA_BOGOTA.format(fecha);
}

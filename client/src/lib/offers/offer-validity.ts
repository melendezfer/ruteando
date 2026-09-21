/**
 * Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
 * ver CLAUDE.md, migración productos-tipo-oferta. El backend solo pide
 * `validFrom`/`validUntil` como fechas ISO crudas — estos atajos
 * ("solo hoy", "este mes") son puramente del cliente, pensados para que
 * un vendedor no tenga que razonar en zona horaria/formato ISO para
 * declarar una oferta corta. `now` es un parámetro (no `new Date()`
 * adentro) solo para que quien llame pueda fijar un instante conocido si
 * hace falta reproducir un caso exacto — en producción siempre es "ahora
 * mismo".
 */
export type OfferValidityShortcut = "today" | "month" | "custom";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** "custom" no tiene un rango calculado — quien llama usa sus propios inputs de fecha. */
export function resolveOfferValidityRange(
  shortcut: "today" | "month",
  now: Date = new Date(),
): { validFrom: string; validUntil: string } {
  if (shortcut === "today") {
    return { validFrom: startOfDay(now).toISOString(), validUntil: endOfDay(now).toISOString() };
  }
  return { validFrom: startOfMonth(now).toISOString(), validUntil: endOfMonth(now).toISOString() };
}

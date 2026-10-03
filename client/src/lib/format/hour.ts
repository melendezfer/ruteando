/** "17:00" → "5:00 p. m." (hora de reloj guardada como texto HH:MM, sin zona). */
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

/** "Domingo 28 · 6:30 p. m." en hora de Bogotá. */
export function formatTodayHeader(now: Date = new Date()): string {
  const dia = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", timeZone: "America/Bogota" }).format(now);
  const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(now);
  const diaCapital = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${diaCapital.replace(",", "")} · ${hora}`;
}

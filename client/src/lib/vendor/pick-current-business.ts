import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];
type ScheduleDay = components["schemas"]["ScheduleDay"];
type Day = ScheduleDay["day"];

const DAYS: Day[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Día y hora ("HH:MM") de ahora en Bogotá. */
export function nowInBogota(date = new Date()): { day: Day; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("weekday").toLowerCase() as Day, time: `${get("hour")}:${get("minute")}` };
}

const hhmm = (t: string | null | undefined) => (t ?? "").slice(0, 5);

/**
 * ¿El horario cubre este momento? Misma regla que el backend
 * (negocios.repository.js#condicionRangoHorarioSQL): un turno que cruza
 * medianoche (cierre < apertura) queda guardado bajo el día en que empieza,
 * así que también se mira la fila de AYER.
 */
export function isOpenAt(schedule: ScheduleDay[], now: { day: Day; time: string }): boolean {
  const yesterday = DAYS[(DAYS.indexOf(now.day) + 6) % 7];
  return schedule.some((row) => {
    if (row.closed || !row.openTime || !row.closeTime) return false;
    const open = hhmm(row.openTime);
    const close = hhmm(row.closeTime);
    const overnight = close < open;
    if (row.day === now.day) return overnight ? now.time >= open : now.time >= open && now.time < close;
    if (row.day === yesterday && overnight) return now.time < close;
    return false;
  });
}

/** Hora a la que abre más tarde hoy, o null. */
function opensLaterToday(schedule: ScheduleDay[], now: { day: Day; time: string }): string | null {
  const today = schedule.find((row) => row.day === now.day && !row.closed && row.openTime);
  const open = hhmm(today?.openTime);
  return open && open > now.time ? open : null;
}

/**
 * El negocio "de ahora" de un vendedor con varios (pedido del usuario,
 * 2026-09-29; docs/specs/perfil-2.md §4.2): 1) el que su horario cubre
 * ahora (si varios, el activo primero); 2) el que abre más pronto hoy;
 * 3) el primero activo; 4) el primero. En la Etapa 2 esta decisión pasa al
 * servidor (spec §7.5) y la usa el Tablero del día.
 */
export function pickCurrentBusiness(
  businesses: Business[],
  schedules: Record<string, ScheduleDay[]>,
  now = nowInBogota(),
): Business | null {
  if (businesses.length === 0) return null;
  const activeFirst = [...businesses].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
  const openNow = activeFirst.find((b) => isOpenAt(schedules[b.id ?? ""] ?? [], now));
  if (openNow) return openNow;
  const later = activeFirst
    .map((b) => ({ b, at: opensLaterToday(schedules[b.id ?? ""] ?? [], now) }))
    .filter((x): x is { b: Business; at: string } => x.at !== null)
    .sort((x, y) => x.at.localeCompare(y.at));
  if (later.length > 0) return later[0].b;
  return activeFirst[0];
}

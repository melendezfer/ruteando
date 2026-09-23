"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Crosshair, Trash } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

type LocationSlot = components["schemas"]["LocationSlot"];
type Day = LocationSlot["day"];

const DAYS: { value: Day; short: string }[] = [
  { value: "monday", short: "Lun" },
  { value: "tuesday", short: "Mar" },
  { value: "wednesday", short: "Mié" },
  { value: "thursday", short: "Jue" },
  { value: "friday", short: "Vie" },
  { value: "saturday", short: "Sáb" },
  { value: "sunday", short: "Dom" },
];
const DAY_ORDER = DAYS.map((d) => d.value);

// Mismo valor que LOCATION_SLOTS_MAX (src/config/constants.js, backend) —
// duplicado a propósito (dos codebases sin paquete compartido, mismo
// criterio que ZONE_RADIUS_METERS), solo para avisar ANTES de mandar un
// PUT que el servidor va a rechazar, con un mensaje que diga la causa real.
const MAX_SLOTS_PER_WEEK = 35;

/** Franjas iguales en todo salvo el día se muestran como una sola fila ("Lun a Vie · 05:00–09:00"). */
interface SlotGroup {
  key: string;
  days: Day[];
  startTime: string;
  endTime: string;
  referenceAddress: string | null;
  slots: LocationSlot[];
}

function groupKey(s: LocationSlot): string {
  return [s.startTime, s.endTime, s.latitude.toFixed(5), s.longitude.toFixed(5), s.referenceAddress ?? ""].join("|");
}

function describeDays(days: Day[]): string {
  if (days.length === 7) return "Todos los días";
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAYS.find((x) => x.value === d)!.short)
    .join(", ");
}

interface LocationSlotsEditorProps {
  businessId: string;
}

/**
 * Franjas del día con ubicación propia (vendedor ambulante — migración
 * franjas-ubicacion-ambulante). Ej.: tinto en el paradero de 5 a 9, en el
 * colegio de 12 a 2. Solo para el dueño de un negocio ambulante (lo
 * decide quien lo monta). Mientras una franja está vigente, el negocio
 * aparece en el mapa en el punto de esa franja; fuera de ellas, en su
 * ubicación de siempre.
 *
 * La ubicación de cada franja se toma "de donde estás parado" (botón), no
 * con un mapa: el caso real es que el vendedor la registra estando en el
 * paradero o en el colegio. Reemplazo completo (PUT), igual que el
 * horario semanal — el servidor valida solapes y responde 422.
 */
export function LocationSlotsEditor({ businessId }: LocationSlotsEditorProps) {
  const [slots, setSlots] = useState<LocationSlot[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reference, setReference] = useState("");
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .GET("/businesses/{businessId}/location-slots", { params: { path: { businessId } } })
      .then(({ data }) => {
        if (!ignore) setSlots(data ?? []);
      });
    return () => {
      ignore = true;
    };
  }, [businessId]);

  const groups = useMemo<SlotGroup[]>(() => {
    const map = new Map<string, SlotGroup>();
    (slots ?? []).forEach((s) => {
      const key = groupKey(s);
      const g = map.get(key) ?? {
        key,
        days: [],
        startTime: s.startTime,
        endTime: s.endTime,
        referenceAddress: s.referenceAddress ?? null,
        slots: [],
      };
      g.days.push(s.day);
      g.slots.push(s);
      map.set(key, g);
    });
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots]);

  async function save(next: LocationSlot[]): Promise<boolean> {
    setSaving(true);
    setError(null);
    const { data, response } = await api.PUT("/businesses/{businessId}/location-slots", {
      params: { path: { businessId } },
      body: next.map(({ day, startTime: st, endTime: et, latitude, longitude, referenceAddress }) => ({
        day,
        startTime: st,
        endTime: et,
        latitude,
        longitude,
        referenceAddress: referenceAddress ?? null,
      })),
    });
    setSaving(false);
    if (!response.ok) {
      setError(
        response.status === 422
          ? "Revisa las horas: una franja no puede empezar y terminar a la misma hora, ni pisarse con otra."
          : response.status === 409
            ? "Solo un negocio ambulante puede tener franjas."
            : "No pudimos guardar las franjas. Intenta de nuevo.",
      );
      return false;
    }
    setSlots(data ?? []);
    return true;
  }

  function takeCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("Este navegador no permite tomar tu ubicación.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("Necesitamos permiso de ubicación para registrar dónde estás en esta franja.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function handleAdd() {
    if (days.length === 0 || !startTime || !endTime || !position) {
      setError("Elige al menos un día, las dos horas y toma la ubicación.");
      return;
    }
    if ((slots?.length ?? 0) + days.length > MAX_SLOTS_PER_WEEK) {
      setError(
        `Puedes tener hasta ${MAX_SLOTS_PER_WEEK} puntos por semana (5 por día) y este te pasaría del límite. Quita alguno o elige menos días.`,
      );
      return;
    }
    const nuevas: LocationSlot[] = days.map((day) => ({
      day,
      startTime,
      endTime,
      latitude: position.latitude,
      longitude: position.longitude,
      referenceAddress: reference.trim() || null,
    }));
    if (await save([...(slots ?? []), ...nuevas])) {
      setAdding(false);
      setDays([]);
      setStartTime("");
      setEndTime("");
      setReference("");
      setPosition(null);
    }
  }

  async function handleRemove(group: SlotGroup) {
    const ids = new Set(group.slots.map((s) => s.id));
    await save((slots ?? []).filter((s) => !ids.has(s.id)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <Clock size={20} weight="bold" className="text-text-muted" />
        <div className="flex flex-col">
          <span className="font-sans text-body text-text">Mis puntos por hora</span>
          <span className="font-sans text-caption text-text-muted">
            Si en cada momento del día vendes en un sitio distinto, el mapa te muestra ahí a esa hora.
          </span>
        </div>
      </div>

      {slots === null ? (
        <p className="font-sans text-body-sm text-text-muted">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="font-sans text-body-sm text-text-muted">Todavía no tienes puntos por hora.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.key} className="flex items-center gap-2 rounded-input bg-background px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-sans text-body-sm font-semibold text-text">
                  {g.startTime}–{g.endTime} · {describeDays(g.days)}
                </span>
                {g.referenceAddress && (
                  <span className="truncate font-sans text-caption text-text-muted">{g.referenceAddress}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(g)}
                disabled={saving}
                aria-label={`Quitar el punto de ${g.startTime} a ${g.endTime}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface disabled:opacity-50"
              >
                <Trash size={18} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días">
            {DAYS.map((d) => {
              const active = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDays((prev) => (active ? prev.filter((x) => x !== d.value) : [...prev, d.value]))}
                  className={`rounded-full border px-3 py-1.5 font-sans text-caption font-medium ${
                    active ? "border-terracota bg-terracota text-white" : "border-border bg-background text-text"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <TextField label="Hasta" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <TextField
            label="¿Dónde? (opcional)"
            placeholder="Ej. paradero de la Avenida Ciudad Verde"
            maxLength={255}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={takeCurrentLocation} loading={locating}>
            <span className="inline-flex items-center gap-2">
              <Crosshair size={18} weight="bold" />
              {position ? "Ubicación tomada — volver a tomar" : "Usar dónde estoy ahora"}
            </span>
          </Button>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAdd} loading={saving} className="flex-1">
              Guardar punto
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          Agregar un punto por hora
        </Button>
      )}

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}

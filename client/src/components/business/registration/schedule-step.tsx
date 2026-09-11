"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";

type Day = components["schemas"]["ScheduleDay"]["day"];

export interface DaySchedule {
  openTime: string;
  closeTime: string;
  closed: boolean;
}

export type WeekSchedule = Record<Day, DaySchedule>;

interface ScheduleStepProps {
  initialValues: WeekSchedule;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: WeekSchedule) => void;
  onBack: () => void;
}

const DAYS: { value: Day; label: string }[] = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];

export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = DAYS.reduce((acc, { value }) => {
  acc[value] = { openTime: "08:00", closeTime: "18:00", closed: false };
  return acc;
}, {} as WeekSchedule);

/**
 * Paso 3 del asistente (RF-008): horario por día de la semana, usado
 * después para calcular "abierto ahora" en la Épica 4. El backend permite
 * turnos que cruzan medianoche (closeTime < openTime, ej. 18:00–02:00) —
 * solo se rechaza openTime === closeTime, ambiguo (ver
 * business.validators.js) — así que la única validación que se hace acá
 * antes de enviar es esa misma igualdad, para no hacer un viaje redondo
 * al servidor por un error que ya se puede detectar en el cliente.
 */
export function ScheduleStep({ initialValues, submitting, error, onSubmit, onBack }: ScheduleStepProps) {
  const [schedule, setSchedule] = useState<WeekSchedule>(initialValues);
  const [localError, setLocalError] = useState<string | null>(null);

  function updateDay(day: Day, patch: Partial<DaySchedule>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    for (const { value, label } of DAYS) {
      const day = schedule[value];
      if (day.closed) continue;
      if (!day.openTime || !day.closeTime) {
        setLocalError(`Completa la hora de apertura y cierre de ${label}, o márcalo como cerrado.`);
        return;
      }
      if (day.openTime === day.closeTime) {
        setLocalError(`En ${label}, la apertura y el cierre no pueden ser iguales.`);
        return;
      }
    }

    onSubmit(schedule);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4" noValidate>
      <div className="flex flex-col gap-3">
        {DAYS.map(({ value, label }) => {
          const day = schedule[value];
          return (
            <div key={value} className="flex flex-col gap-2 rounded-card border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-sans text-body font-medium text-text">{label}</span>
                <label className="flex items-center gap-2 font-sans text-body-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(event) => updateDay(value, { closed: event.target.checked })}
                  />
                  Cerrado
                </label>
              </div>
              {!day.closed && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">
                      Apertura
                    </span>
                    <input
                      type="time"
                      required
                      value={day.openTime}
                      onChange={(event) => updateDay(value, { openTime: event.target.value })}
                      className="rounded-input border border-border px-3 py-2 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">
                      Cierre
                    </span>
                    <input
                      type="time"
                      required
                      value={day.closeTime}
                      onChange={(event) => updateDay(value, { closeTime: event.target.value })}
                      className="rounded-input border border-border px-3 py-2 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(localError || error) && (
        <p className="font-sans text-body-sm text-rojo">{localError ?? error}</p>
      )}

      <div className="mt-auto flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button type="submit" loading={submitting} className="flex-1">
          Finalizar registro
        </Button>
      </div>
    </form>
  );
}

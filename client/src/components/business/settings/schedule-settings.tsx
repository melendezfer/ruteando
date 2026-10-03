"use client";

import { useState } from "react";
import {
  ScheduleStep,
  type WeekSchedule,
} from "@/components/business/registration/schedule-step";
import { api } from "@/lib/api/client";
import { getBusinessFormErrorMessage } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type Day = components["schemas"]["ScheduleDay"]["day"];

interface ScheduleSettingsProps {
  businessId: string;
  schedule: WeekSchedule;
  onSaved: (schedule: WeekSchedule) => void;
}

/**
 * Horario de la semana editable después del registro (C3, R7 —
 * docs/specs/perfil-2.md §5). Reusa el MISMO editor del asistente
 * (ScheduleStep) y el mismo PUT /businesses/{id}/schedule (reemplazo
 * completo), así que las reglas (turno nocturno permitido, apertura ≠
 * cierre) son las mismas en los dos lugares.
 */
export function ScheduleSettings({ businessId, schedule, onSaved }: ScheduleSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(values: WeekSchedule) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const body = (Object.keys(values) as Day[]).map((day) => {
      const v = values[day];
      return v.closed ? { day, closed: true } : { day, closed: false, openTime: v.openTime, closeTime: v.closeTime };
    });
    const { response } = await api.PUT("/businesses/{businessId}/schedule", {
      params: { path: { businessId } },
      body,
    });
    setSaving(false);
    if (!response.ok) {
      setError(getBusinessFormErrorMessage(response.status));
      return;
    }
    setSaved(true);
    onSaved(values);
  }

  return (
    <div className="flex flex-col gap-2">
      <ScheduleStep
        initialValues={schedule}
        submitting={saving}
        error={error}
        onSubmit={handleSubmit}
        submitLabel="Guardar horario"
      />
      {saved && <p className="font-sans text-body-sm text-verde-texto">Horario guardado.</p>}
    </div>
  );
}

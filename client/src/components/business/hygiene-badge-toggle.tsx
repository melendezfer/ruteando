"use client";

import { useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { HYGIENE_DISCLAIMER_BODY, HYGIENE_GUIDE_STEPS } from "@/lib/hygiene/hygiene";

interface HygieneBadgeToggleProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  initialHygieneSelfDeclared: boolean;
}

/**
 * "Declaro que sigo estas buenas prácticas de higiene" — solo visible
 * para el dueño en su propio perfil de negocio
 * (business-profile-screen.tsx). Mismo patrón que OwnDeliveryToggle:
 * hygieneSelfDeclared vive en BusinessInput y se cambia con el mismo
 * PATCH /businesses/{businessId} que usa el asistente de registro — así
 * que este componente manda el resto de los campos actuales del negocio
 * tal cual (name/categoryId obligatorios en BusinessInput;
 * description/contactPhone se conservan) para no pisarlos solo por
 * cambiar este interruptor. No manda `ownDelivery` — el backend
 * conserva su valor existente cuando el campo llega ausente
 * (negocios.service.js#actualizar), mismo criterio inverso al que ya
 * usa OwnDeliveryToggle con este campo.
 *
 * CUIDADO LEGAL: el párrafo de aclaración (HYGIENE_DISCLAIMER_BODY) se
 * muestra ANTES del interruptor, no después — quien está por activar el
 * sello debe leer primero que es una declaración propia sin
 * verificación de RUTEANDO, no encontrarlo como letra pequeña una vez
 * ya lo activó.
 */
export function HygieneBadgeToggle({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  initialHygieneSelfDeclared,
}: HygieneBadgeToggleProps) {
  const [enabled, setEnabled] = useState(initialHygieneSelfDeclared);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  async function handleChange(next: boolean) {
    if (next === enabled || saving) return;
    setSaving(true);
    setError(null);

    const { response } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: {
        name,
        description: description ?? undefined,
        categoryId,
        contactPhone: contactPhone ?? undefined,
        hygieneSelfDeclared: next,
      },
    });

    setSaving(false);

    if (!response.ok) {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
      return;
    }

    setEnabled(next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} weight="duotone" className="text-verde" />
        <p className="font-sans text-body font-medium text-text">Sello de higiene autodeclarada</p>
      </div>

      {HYGIENE_DISCLAIMER_BODY.map((paragraph, index) => (
        <p
          key={paragraph}
          className={`font-sans text-body-sm ${index === 0 ? "text-text-muted" : "font-medium text-text-muted"}`}
        >
          {paragraph}
        </p>
      ))}

      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={`hygieneSelfDeclared-${businessId}`}
          className="font-sans text-body-sm font-medium text-text"
        >
          Declaro que sigo estas buenas prácticas
        </label>
        <input
          id={`hygieneSelfDeclared-${businessId}`}
          type="checkbox"
          role="switch"
          aria-checked={enabled}
          checked={enabled}
          disabled={saving}
          onChange={(event) => handleChange(event.target.checked)}
          className="h-5 w-5 accent-verde"
        />
      </div>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      <button
        type="button"
        onClick={() => setShowGuide((prev) => !prev)}
        aria-expanded={showGuide}
        className="self-start font-sans text-body-sm font-medium text-terracota underline"
      >
        {showGuide ? "Ocultar guía de buenas prácticas" : "Ver guía de 5 pasos de buenas prácticas"}
      </button>

      {showGuide && (
        <ol className="flex flex-col gap-2 border-t border-border pt-3">
          {HYGIENE_GUIDE_STEPS.map((step, index) => (
            <li key={step.title} className="font-sans text-body-sm text-text">
              <span className="font-semibold">
                {index + 1}. {step.title}
              </span>{" "}
              — {step.description}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

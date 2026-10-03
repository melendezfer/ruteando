"use client";

import { useState, type FormEvent } from "react";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { getBusinessFormErrorMessage, getFieldErrors } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

interface ContactPhoneSettingsProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  phoneVerified: boolean;
  onSaved: (business: Business) => void;
}

/**
 * WhatsApp del negocio (C3, "Cómo comprar" — docs/specs/perfil-2.md §5).
 * Antes solo se escribía en el asistente de registro. Cambiarlo quita la
 * verificación (el backend lo hace en el mismo UPDATE:
 * negocios.repository.js#actualizar), así que se avisa ANTES de guardar.
 */
export function ContactPhoneSettings({
  businessId,
  name,
  description,
  categoryId,
  contactPhone,
  phoneVerified,
  onSaved,
}: ContactPhoneSettingsProps) {
  const [phone, setPhone] = useState(contactPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dirty = phone.trim() !== (contactPhone ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim()) {
      setFieldErrors({ contactPhone: "Escribe el número de WhatsApp de tu negocio." });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const { data, response, error: errorBody } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: { name, description: description ?? undefined, categoryId, contactPhone: phone.trim() },
    });

    setSaving(false);
    if (!response.ok || !data) {
      setError(getBusinessFormErrorMessage(response.status));
      setFieldErrors(getFieldErrors(errorBody));
      return;
    }
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <TextField
        label="WhatsApp del negocio"
        type="tel"
        placeholder="Ej: 3001234567"
        maxLength={20}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldErrors.contactPhone}
      />
      {dirty && phoneVerified && (
        <p className="rounded-input bg-ambar-suave px-3 py-2 font-sans text-body-sm text-ambar-texto">
          Al cambiar el número tendrás que verificarlo otra vez por SMS; mientras tanto tu negocio no aparece en el
          mapa.
        </p>
      )}
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
      {dirty && (
        <Button type="submit" loading={saving} variant="secondary" className="flex w-full items-center justify-center gap-2">
          <WhatsappLogo size={18} weight="bold" />
          Guardar número
        </Button>
      )}
    </form>
  );
}

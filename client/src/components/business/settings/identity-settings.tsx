"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useCategoriesWithStatus } from "@/lib/categories/use-categories";
import { api } from "@/lib/api/client";
import { getBusinessFormErrorMessage, getFieldErrors } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

/** Lo que se ve de la descripción sin tocar "ver más" (spec perfil-2 §3.1). */
export const DESCRIPTION_VISIBLE_CHARS = 120;
/** Tope de la descripción en esta pantalla (spec §5); el backend admite 2000. */
export const DESCRIPTION_MAX_CHARS = 500;

interface IdentitySettingsProps {
  businessId: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  onSaved: (business: Business) => void;
}

/**
 * Identidad del negocio (C3, R7 — docs/specs/perfil-2.md §5): nombre,
 * categoría y descripción, editables después del registro (antes solo se
 * elegían en el asistente). Mismo PATCH /businesses/{id} del asistente;
 * manda también el teléfono actual para no borrarlo.
 */
export function IdentitySettings({
  businessId,
  name: initialName,
  description: initialDescription,
  categoryId: initialCategoryId,
  contactPhone,
  onSaved,
}: IdentitySettingsProps) {
  const { categories, loading: categoriesLoading } = useCategoriesWithStatus();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [categoryId, setCategoryId] = useState<number>(initialCategoryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const dirty =
    name.trim() !== initialName || description.trim() !== (initialDescription ?? "") || categoryId !== initialCategoryId;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: "Escribe el nombre de tu negocio." });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const { data, response, error: errorBody } = await api.PATCH("/businesses/{businessId}", {
      params: { path: { businessId } },
      body: {
        name: name.trim(),
        // "" (no null): BusinessInput no declara description como nullable; vacía = sin descripción.
        description: description.trim(),
        categoryId,
        contactPhone: contactPhone ?? undefined,
      },
    });

    setSaving(false);
    if (!response.ok || !data) {
      setError(getBusinessFormErrorMessage(response.status));
      setFieldErrors(getFieldErrors(errorBody));
      return;
    }
    setSaved(true);
    onSaved(data);
  }

  const remaining = DESCRIPTION_MAX_CHARS - description.length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Nombre del negocio"
        type="text"
        maxLength={150}
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
        }}
        error={fieldErrors.name}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`identity-category-${businessId}`} className="font-sans text-body-sm font-medium text-text">
          Categoría
        </label>
        <select
          id={`identity-category-${businessId}`}
          disabled={categoriesLoading}
          value={categoryId}
          onChange={(event) => {
            setCategoryId(Number(event.target.value));
            setSaved(false);
          }}
          className="min-h-11 rounded-input border border-borde-control bg-surface px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`identity-description-${businessId}`} className="font-sans text-body-sm font-medium text-text">
          Descripción corta
        </label>
        <textarea
          id={`identity-description-${businessId}`}
          rows={3}
          maxLength={DESCRIPTION_MAX_CHARS}
          value={description}
          aria-describedby={`identity-description-help-${businessId}`}
          onChange={(event) => {
            setDescription(event.target.value);
            setSaved(false);
          }}
          className="rounded-input border border-borde-control px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
        />
        <p id={`identity-description-help-${businessId}`} className="font-sans text-body-sm text-text-muted">
          Tus clientes ven las primeras {DESCRIPTION_VISIBLE_CHARS} letras
          {description.length > DESCRIPTION_VISIBLE_CHARS ? " (lo demás con “ver más”)" : ""}. Te quedan {remaining}.
        </p>
      </div>

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
      {saved && !dirty && <p className="font-sans text-body-sm text-verde-texto">Guardado.</p>}

      <Button type="submit" loading={saving} disabled={!dirty} className="w-full">
        Guardar identidad
      </Button>
    </form>
  );
}

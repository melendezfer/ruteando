"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";

type Category = components["schemas"]["Category"];

export interface BusinessDetailsValues {
  name: string;
  description: string;
  categoryId: number | "";
  contactPhone: string;
}

interface DetailsStepProps {
  categories: Category[];
  categoriesLoading: boolean;
  initialValues: BusinessDetailsValues;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: BusinessDetailsValues) => void;
}

/**
 * Paso 1 del asistente de registro (RF-004): nombre, categoría,
 * descripción y teléfono de contacto — los campos exactos de
 * BusinessInput, sin agregar ninguno que el contrato no pida (RNF-013,
 * flujo corto).
 *
 * contactPhone es `required` acá aunque BusinessInput lo declara
 * opcional en el backend (y sigue siéndolo para otros llamadores, ej.
 * registro asistido) — sin él no hay forma de completar la verificación
 * de teléfono (ver CLAUDE.md), y este asistente es hoy el único camino
 * que tiene un vendedor para registrar su propio negocio, así que
 * exigirlo acá evita dejarlo sin ninguna forma de agregarlo después (no
 * existe todavía una pantalla de "editar negocio" fuera de este flujo).
 */
export function DetailsStep({
  categories,
  categoriesLoading,
  initialValues,
  submitting,
  error,
  fieldErrors,
  onSubmit,
}: DetailsStepProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [categoryId, setCategoryId] = useState<number | "">(initialValues.categoryId);
  const [contactPhone, setContactPhone] = useState(initialValues.contactPhone);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, description, categoryId, contactPhone });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4" noValidate>
      <TextField
        label="Nombre del negocio"
        type="text"
        maxLength={150}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="font-sans text-body-sm font-medium text-text">
          Categoría
        </label>
        <select
          id="categoryId"
          required
          disabled={categoriesLoading}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : "")}
          className={`rounded-input border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40 ${
            fieldErrors.categoryId ? "border-rojo" : "border-border"
          }`}
        >
          <option value="">{categoriesLoading ? "Cargando categorías…" : "Selecciona una categoría"}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId && (
          <p className="font-sans text-body-sm text-rojo">{fieldErrors.categoryId}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-sans text-body-sm font-medium text-text">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
        />
      </div>

      <TextField
        label="Teléfono de contacto (WhatsApp)"
        type="tel"
        placeholder="Ej: 3001234567"
        maxLength={20}
        required
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
        error={fieldErrors.contactPhone}
      />
      <p className="-mt-2 font-sans text-caption text-text-muted">
        Es el mismo número que verán tus clientes en WhatsApp — también lo vamos a verificar por SMS
        antes de que tu negocio aparezca en el mapa.
      </p>

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      <div className="mt-auto pt-2">
        <Button type="submit" loading={submitting} className="w-full">
          Continuar
        </Button>
      </div>
    </form>
  );
}

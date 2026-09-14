"use client";

import { useState, type FormEvent } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

export interface ProductFormValues {
  name: string;
  /** Texto crudo del input — la conversión a número y su validación viven en quien llama (mismo criterio que business-registration-wizard.tsx#handleLocationSubmit con latitude/longitude). */
  price: string;
  description: string;
  available: boolean;
}

interface ProductFormProps {
  mode: "create" | "edit";
  /** "plato"/"producto"/"servicio"/"ítem" según el tipo de categoría — ver catalog-label.ts#resolveItemNoun. */
  itemNoun: string;
  initialValues?: ProductFormValues;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
}

const EMPTY_VALUES: ProductFormValues = { name: "", price: "", description: "", available: true };

/**
 * Gestión del catálogo (agregar/editar, sin épica de frontend asignada
 * hasta ahora — petición directa del usuario). Un solo componente para
 * crear y editar (mismos campos, mismo layout) — `mode` solo cambia el
 * título y el texto del botón de enviar, igual que `PhotoUploadControl`
 * es un solo componente para negocio y producto.
 *
 * Modal como "bottom sheet" (CLAUDE.md sección 17: "un bottom sheet que
 * sube desde abajo, no una pantalla nueva"), mismo patrón visual exacto
 * que `AccountDeletionRequestModal`/`ConsentRequiredModal`.
 *
 * `available` por defecto en `true` — mismo default que ya aplica
 * `productos.service.js#crear` en el backend cuando el campo no se
 * manda; acá se manda siempre explícito (no se omite), así que el
 * default vive en `EMPTY_VALUES`, no en el backend, para este flujo.
 */
export function ProductForm({
  mode,
  itemNoun,
  initialValues,
  submitting,
  error,
  fieldErrors,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? EMPTY_VALUES.name);
  const [price, setPrice] = useState(initialValues?.price ?? EMPTY_VALUES.price);
  const [description, setDescription] = useState(initialValues?.description ?? EMPTY_VALUES.description);
  const [available, setAvailable] = useState(initialValues?.available ?? EMPTY_VALUES.available);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, price, description, available });
  }

  const title = mode === "create" ? `Agregar ${itemNoun}` : `Editar ${itemNoun}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-card bg-surface p-6 shadow-xl sm:rounded-card"
        noValidate
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="product-form-title" className="font-heading text-title-1 font-bold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cerrar"
            className="text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <TextField
          label="Nombre"
          type="text"
          maxLength={150}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
        />

        <TextField
          label="Precio (COP)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          error={fieldErrors.price}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-description" className="font-sans text-body-sm font-medium text-text">
            Descripción (opcional)
          </label>
          <textarea
            id="product-description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
          />
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="font-sans text-body-sm font-medium text-text">Disponible</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={available}
            checked={available}
            onChange={(event) => setAvailable(event.target.checked)}
            className="h-5 w-5 accent-terracota"
          />
        </label>

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} className="flex-1">
            {mode === "create" ? "Agregar" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

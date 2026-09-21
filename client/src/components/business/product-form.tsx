"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { resolveOfferValidityRange, type OfferValidityShortcut } from "@/lib/offers/offer-validity";

type OfferType = components["schemas"]["OfferType"];

export interface ProductFormValues {
  name: string;
  /** Texto crudo del input — la conversión a número y su validación viven en quien llama (mismo criterio que business-registration-wizard.tsx#handleLocationSubmit con latitude/longitude). */
  price: string;
  description: string;
  available: boolean;
  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado
  // — ver CLAUDE.md, migración productos-tipo-oferta. `null` los tres
  // para un ítem de catálogo normal (el caso de siempre).
  offerTypeId: number | null;
  validFrom: string | null;
  validUntil: string | null;
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

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  price: "",
  description: "",
  available: true,
  offerTypeId: null,
  validFrom: null,
  validUntil: null,
};

/** ISO -> valor de un <input type="datetime-local"> en hora LOCAL (no UTC — un vendedor piensa "hasta las 8pm de hoy", no en UTC). */
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
  // ver CLAUDE.md, migración productos-tipo-oferta. `isOffer` decide si
  // la sección se muestra en absoluto — la mayoría de los ítems de
  // catálogo son normales, así que arranca colapsada salvo que
  // `initialValues` ya traiga una oferta real (editar una existente).
  const [isOffer, setIsOffer] = useState(
    Boolean(initialValues?.offerTypeId || initialValues?.validFrom),
  );
  const [offerTypes, setOfferTypes] = useState<OfferType[]>([]);
  const [offerTypeId, setOfferTypeId] = useState<number | null>(initialValues?.offerTypeId ?? null);
  // Al editar una oferta ya existente, arranca en "custom" (mostrando las
  // fechas reales tal cual, editables) — no hay forma confiable de
  // adivinar si esas fechas exactas vinieron de un atajo "solo hoy"/
  // "este mes" o de un rango personalizado.
  const [shortcut, setShortcut] = useState<OfferValidityShortcut>(
    initialValues?.validFrom ? "custom" : "today",
  );
  const [customValidFrom, setCustomValidFrom] = useState(
    initialValues?.validFrom ? toDatetimeLocalValue(initialValues.validFrom) : "",
  );
  const [customValidUntil, setCustomValidUntil] = useState(
    initialValues?.validUntil ? toDatetimeLocalValue(initialValues.validUntil) : "",
  );
  const [offerError, setOfferError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api.GET("/offer-types").then(({ data }) => {
      if (!ignore && data) setOfferTypes(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setOfferError(null);

    if (!isOffer) {
      onSubmit({ name, price, description, available, offerTypeId: null, validFrom: null, validUntil: null });
      return;
    }

    let validFrom: string;
    let validUntil: string | null;
    if (shortcut === "custom") {
      if (!customValidFrom) {
        setOfferError("Elige desde cuándo es vigente la oferta.");
        return;
      }
      validFrom = new Date(customValidFrom).toISOString();
      validUntil = customValidUntil ? new Date(customValidUntil).toISOString() : null;
      if (validUntil && new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
        setOfferError('"Hasta" debe ser posterior a "Desde".');
        return;
      }
    } else {
      const range = resolveOfferValidityRange(shortcut);
      validFrom = range.validFrom;
      validUntil = range.validUntil;
    }

    onSubmit({ name, price, description, available, offerTypeId, validFrom, validUntil });
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

        <label className="flex items-center justify-between gap-3">
          <span className="font-sans text-body-sm font-medium text-text">Es una oferta con vigencia</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={isOffer}
            checked={isOffer}
            onChange={(event) => setIsOffer(event.target.checked)}
            className="h-5 w-5 accent-terracota"
          />
        </label>

        {isOffer && (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-background p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-offer-type" className="font-sans text-body-sm font-medium text-text">
                Tipo de oferta (opcional)
              </label>
              <select
                id="product-offer-type"
                value={offerTypeId ?? ""}
                onChange={(event) => setOfferTypeId(event.target.value ? Number(event.target.value) : null)}
                className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
              >
                <option value="">Sin tipo</option>
                {offerTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-body-sm font-medium text-text">Vigencia</span>
              <div role="radiogroup" aria-label="Vigencia de la oferta" className="flex flex-wrap gap-2">
                {(
                  [
                    ["today", "Solo hoy"],
                    ["month", "Este mes"],
                    ["custom", "Personalizado"],
                  ] as [OfferValidityShortcut, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={shortcut === value}
                    onClick={() => setShortcut(value)}
                    className={`rounded-full px-3 py-1.5 font-sans text-body-sm font-medium transition-colors ${
                      shortcut === value ? "bg-terracota text-white" : "border border-border text-text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {shortcut === "custom" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <TextField
                  label="Desde"
                  type="datetime-local"
                  required
                  value={customValidFrom}
                  onChange={(event) => setCustomValidFrom(event.target.value)}
                  className="flex-1"
                />
                <TextField
                  label="Hasta (opcional)"
                  type="datetime-local"
                  value={customValidUntil}
                  onChange={(event) => setCustomValidUntil(event.target.value)}
                  className="flex-1"
                />
              </div>
            )}

            {offerError && <p className="font-sans text-body-sm text-rojo">{offerError}</p>}
          </div>
        )}

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

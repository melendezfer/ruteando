"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";

type Category = components["schemas"]["Category"];

export interface AssistedRegistrationValues {
  vendorFullName: string;
  vendorEmail: string;
  vendorPhone: string;
  businessName: string;
  businessDescription: string;
  businessCategoryId: number | "";
  businessContactPhone: string;
}

interface AssistedFormStepProps {
  categories: Category[];
  categoriesLoading: boolean;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: AssistedRegistrationValues) => void;
}

const EMPTY_VALUES: AssistedRegistrationValues = {
  vendorFullName: "",
  vendorEmail: "",
  vendorPhone: "",
  businessName: "",
  businessDescription: "",
  businessCategoryId: "",
  businessContactPhone: "",
};

/**
 * Registro asistido (RF-018, PR #11) — POST /auth/assisted-registration,
 * solo administradores (403 para cualquier otro rol, verificado en el
 * backend; ver requireRole('administrator') en auth.routes.js). Pensado
 * para Don Alirio (Documento 08, baja familiaridad digital): un
 * administrador completa este formulario en su nombre y le entrega el
 * claimToken resultante por el medio que tenga a mano — sin proveedor de
 * correo/SMS conectado todavía (CLAUDE.md sección 10).
 *
 * consentTextVersion no es un campo editable acá — CLAUDE.md documenta
 * (sección 10, Épica 8) que esa versión de texto legal todavía no tiene
 * una pantalla real en el frontend (pendiente de la Épica F6); se usa un
 * valor fijo (ASSISTED_CONSENT_TEXT_VERSION) hasta que exista.
 */
export function AssistedFormStep({
  categories,
  categoriesLoading,
  submitting,
  error,
  fieldErrors,
  onSubmit,
}: AssistedFormStepProps) {
  const [values, setValues] = useState<AssistedRegistrationValues>(EMPTY_VALUES);
  const [confirmed, setConfirmed] = useState(false);

  function set<K extends keyof AssistedRegistrationValues>(key: K, value: AssistedRegistrationValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-title-2 font-semibold text-text">Datos del vendedor</legend>
        <TextField
          label="Nombre completo"
          type="text"
          maxLength={150}
          required
          value={values.vendorFullName}
          onChange={(event) => set("vendorFullName", event.target.value)}
          error={fieldErrors["vendor.fullName"]}
        />
        <TextField
          label="Correo (opcional)"
          type="email"
          value={values.vendorEmail}
          onChange={(event) => set("vendorEmail", event.target.value)}
          error={fieldErrors["vendor.email"]}
        />
        <TextField
          label="Teléfono (opcional)"
          type="tel"
          maxLength={20}
          value={values.vendorPhone}
          onChange={(event) => set("vendorPhone", event.target.value)}
          error={fieldErrors["vendor.phone"]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-title-2 font-semibold text-text">Datos del negocio</legend>
        <TextField
          label="Nombre del negocio"
          type="text"
          maxLength={150}
          required
          value={values.businessName}
          onChange={(event) => set("businessName", event.target.value)}
          error={fieldErrors["business.name"]}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="assistedCategoryId" className="font-sans text-body-sm font-medium text-text">
            Categoría
          </label>
          <select
            id="assistedCategoryId"
            required
            disabled={categoriesLoading}
            value={values.businessCategoryId}
            onChange={(event) =>
              set("businessCategoryId", event.target.value ? Number(event.target.value) : "")
            }
            className={`rounded-input border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40 ${
              fieldErrors["business.categoryId"] ? "border-rojo" : "border-border"
            }`}
          >
            <option value="">{categoriesLoading ? "Cargando categorías…" : "Selecciona una categoría"}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldErrors["business.categoryId"] && (
            <p className="font-sans text-body-sm text-rojo">{fieldErrors["business.categoryId"]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="assistedDescription" className="font-sans text-body-sm font-medium text-text">
            Descripción (opcional)
          </label>
          <textarea
            id="assistedDescription"
            rows={3}
            maxLength={2000}
            value={values.businessDescription}
            onChange={(event) => set("businessDescription", event.target.value)}
            className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
          />
        </div>

        <TextField
          label="Teléfono de contacto (WhatsApp, opcional)"
          type="tel"
          maxLength={20}
          value={values.businessContactPhone}
          onChange={(event) => set("businessContactPhone", event.target.value)}
          error={fieldErrors["business.contactPhone"]}
        />
      </fieldset>

      <label className="flex items-start gap-2 font-sans text-body-sm text-text">
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        Confirmo que el vendedor autorizó este registro asistido y que le entregaré el código de
        activación que se genere.
      </label>

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      <div className="mt-auto pt-2">
        <Button type="submit" loading={submitting} disabled={!confirmed} className="w-full">
          Registrar vendedor y negocio
        </Button>
      </div>
    </form>
  );
}

"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { BusinessCard } from "@/components/discovery/business-card";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

interface BusinessSummarySheetProps {
  business: Business;
  categoryName: string | null;
  onClose: () => void;
}

/**
 * "Bottom sheet" que sube desde abajo del mapa (CLAUDE.md sección 17,
 * Documento 08 §5.4.2) al tocar un pin — nunca navega a otra pantalla. Se
 * apoya en BusinessCard (Épica F2) con `defaultExpanded`, así que el
 * resumen (horario de hoy + calificación) ya está visible desde el primer
 * toque sobre el pin, sin un segundo toque para expandir.
 */
export function BusinessSummarySheet({ business, categoryName, onClose }: BusinessSummarySheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] px-3 pb-3">
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar resumen del negocio"
          className="absolute -top-3 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text shadow"
        >
          <X size={16} weight="bold" />
        </button>
        <BusinessCard
          key={business.id}
          business={business}
          categoryName={categoryName}
          defaultExpanded
        />
      </div>
    </div>
  );
}

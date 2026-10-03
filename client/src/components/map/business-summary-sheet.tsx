"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { BusinessCard } from "@/components/discovery/business-card";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

interface BusinessSummarySheetProps {
  business: Business;
  categoryName: string | null;
  onClose: () => void;
  /** Modo sencillo/avanzado (Fase 3, CLAUDE.md sección 48) — pasado tal cual a BusinessCard. */
  showPrices: boolean;
}

/**
 * "Bottom sheet" que sube desde abajo del mapa (CLAUDE.md sección 17,
 * Documento 08 §5.4.2) al tocar un pin — nunca navega a otra pantalla. Se
 * apoya en BusinessCard (Épica F2) con `defaultExpanded`, así que el
 * resumen (horario de hoy + calificación) ya está visible desde el primer
 * toque sobre el pin, sin un segundo toque para expandir.
 */
export function BusinessSummarySheet({ business, categoryName, onClose, showPrices }: BusinessSummarySheetProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-8 bottom-0 z-(--capa-hojas) flex flex-col justify-end reserva-columna pb-3 pl-3">
      {/*
        Contenedor de top-8 a bottom-0, sin capturar toques (el mapa de
        arriba sigue usable): así la hoja nunca sube hasta la franja de
        arriba del mapa, donde vive el crédito de OpenStreetMap
        (fix/credito-osm-visible, e2e/credito-osm.spec.ts). La hoja misma
        mide como mucho min(<alto de siempre>, 100% de este contenedor).
      */}
      <div className="pointer-events-auto relative max-h-full overflow-y-auto pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar resumen del negocio"
          className="absolute -top-3 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text shadow"
        >
          <X size={16} weight="bold" />
        </button>
        <BusinessCard
          key={business.id}
          business={business}
          categoryName={categoryName}
          defaultExpanded
          showPrices={showPrices}
          hideMapLink
        />
      </div>
    </div>
  );
}

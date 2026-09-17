"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { BusinessPin } from "@/components/map/leaflet-map";
import { MatchReasonBadges } from "@/components/discovery/match-reason-badges";
import { formatDistance } from "@/lib/format/distance";

interface MapSearchResultsProps {
  query: string;
  results: BusinessPin[];
  loading: boolean;
  categoryNameById: Map<number, string>;
  onSelect: (business: BusinessPin) => void;
  /** Modo sencillo/avanzado (Fase 3, CLAUDE.md sección 48) — ver MatchReasonBadges#showPrices. */
  showPrices: boolean;
}

/**
 * Lista de resultados de texto libre sobre el mapa (Fase 1 de la fusión
 * de buscadores, sin RF asociado — ver CLAUDE.md sección 45): antes de
 * esto, el mapa no tenía ninguna caja de texto — solo filtros de
 * precio/abierto-ahora/radio (MapFiltersSheet) sobre los pines. Tocar un
 * resultado hace lo mismo que tocar su pin (recentra + abre
 * BusinessSummarySheet, ver map-screen.tsx#handleSelectBusiness) — no
 * duplica esa experiencia, solo la hace accesible sin tener que
 * encontrar el pin a ojo en el mapa.
 *
 * Reusa `businesses` (ya filtrado a BusinessPin, con coordenadas) en vez
 * de pedir una lista aparte: son exactamente los mismos negocios que ya
 * se dibujan como pines con la búsqueda de texto activa.
 */
export function MapSearchResults({
  query,
  results,
  loading,
  categoryNameById,
  onSelect,
  showPrices,
}: MapSearchResultsProps) {
  if (!query) return null;

  return (
    <div className="absolute inset-x-3 top-36 z-[900] max-h-[50%] overflow-y-auto rounded-card border border-border bg-surface shadow-lg">
      {loading && (
        <p className="px-4 py-3 font-sans text-body-sm text-text-muted">Buscando...</p>
      )}

      {!loading && results.length === 0 && (
        <p className="px-4 py-3 font-sans text-body-sm text-text-muted">
          No encontramos negocios que coincidan con &quot;{query}&quot;.
        </p>
      )}

      {!loading &&
        results.map((business) => {
          const categoryName =
            business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null;
          return (
            <button
              key={business.id}
              type="button"
              onClick={() => onSelect(business)}
              className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-background"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-body font-semibold text-text">{business.name}</span>
                <span className="font-sans text-body-sm text-text-muted">
                  {categoryName ?? "Comercio informal"}
                  {typeof business.distanceMeters === "number" ? ` · ${formatDistance(business.distanceMeters)}` : ""}
                </span>
                {/* Por qué coincidió (Fases 2 y 5, CLAUDE.md sección
                    47/50) — ya viene calculado por el backend sobre
                    esta misma `q`. */}
                <MatchReasonBadges
                  matchType={business.matchType}
                  matchedProducts={business.matchedProducts}
                  matchedCategory={business.matchedCategory}
                  categoryName={categoryName}
                  showPrices={showPrices}
                />
              </div>
              <CaretRight size={18} className="shrink-0 text-text-muted" />
            </button>
          );
        })}
    </div>
  );
}

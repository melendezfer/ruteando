"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/discovery/search-bar";
import { SearchModeToggle } from "@/components/discovery/search-mode-toggle";
import { PriceOpenNowFields, type PriceOpenNowState } from "@/components/discovery/price-open-now-fields";
import { MapSearchResults } from "@/components/map/map-search-results";
import type { BusinessPin } from "@/components/map/leaflet-map";

export interface MapFiltersState extends PriceOpenNowState {
  // Opcional a propósito — solo tiene sentido con geolocalización
  // concedida (ver `showRadius` más abajo).
  radiusKm?: number;
}

interface MapSearchSheetProps {
  searchKey: number;
  query: string;
  onSearch: (text: string) => void;
  onClear: () => void;
  advanced: boolean;
  onModeChange: (advanced: boolean) => void;
  filters: MapFiltersState;
  onFiltersChange: (filters: MapFiltersState) => void;
  showRadius: boolean;
  results: BusinessPin[];
  resultsLoading: boolean;
  categoryNameById: Map<number, string>;
  onSelectResult: (business: BusinessPin) => void;
  onClose: () => void;
}

const RADIUS_OPTIONS = [2, 5, 10];

/**
 * Retroalimentación sobre el buscador ya construido (Fase B, sin RF
 * asociado — ver CLAUDE.md sección 51): reemplaza DOS superficies que
 * competían por el mismo espacio — la caja de texto fija arriba del
 * mapa (Fase 1, sección 45) y el panel "Filtros" aparte (distancia/
 * precio/abierto-ahora, también Fase 1) — por una sola hoja inferior,
 * abierta desde el botón circular "Buscar" que reemplaza al secundario
 * "Filtros" de `FloatingActionStack` (mismo slot, mismo contrato de 2
 * botones — no hizo falta tocar ese componente).
 *
 * Todo en un solo lugar, de arriba hacia abajo: texto libre →
 * Sencilla/Avanzada → (si Avanzada) distancia + precio, con "Abierto
 * ahora" siempre disponible en los dos modos (decisión explícita del
 * usuario, confirmada antes de implementar — CLAUDE.md sección 51: NO
 * se mueve a Avanzada-only pese a que la propuesta original lo sugería)
 * → resultados de la búsqueda de texto, si hay alguna. `MapSearchResults`
 * ya no se posiciona a sí mismo (perdió su `absolute`/offset propio en
 * este mismo cambio) — es contenido puro, embebido acá.
 */
export function MapSearchSheet({
  searchKey,
  query,
  onSearch,
  onClear,
  advanced,
  onModeChange,
  filters,
  onFiltersChange,
  showRadius,
  results,
  resultsLoading,
  categoryNameById,
  onSelectResult,
  onClose,
}: MapSearchSheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] px-3 pb-3">
      <div className="relative flex max-h-[75vh] flex-col rounded-card border border-border bg-surface shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar búsqueda"
          className="absolute -top-3 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text shadow"
        >
          <X size={16} weight="bold" />
        </button>

        <div className="flex flex-col gap-3 p-4 pb-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SearchBar key={searchKey} onSearch={onSearch} />
            </div>
            {query && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Limpiar búsqueda"
                className="flex h-btn w-btn shrink-0 items-center justify-center rounded-full border border-border text-text-muted hover:bg-background"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>

          <SearchModeToggle advanced={advanced} onChange={onModeChange} />

          <div className="flex flex-wrap items-end gap-3">
            {advanced && showRadius && (
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-body-sm font-medium text-text">Distancia</span>
                <select
                  value={filters.radiusKm}
                  onChange={(event) => onFiltersChange({ ...filters, radiusKm: Number(event.target.value) })}
                  className="rounded-input border border-border px-3 py-2 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </select>
              </label>
            )}
            <PriceOpenNowFields
              value={filters}
              onChange={(next) => onFiltersChange({ ...filters, ...next })}
              showPrice={advanced}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border">
          <MapSearchResults
            query={query}
            results={results}
            loading={resultsLoading}
            categoryNameById={categoryNameById}
            onSelect={onSelectResult}
            showPrices={advanced}
          />
        </div>
      </div>
    </div>
  );
}

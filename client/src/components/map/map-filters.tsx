"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { PriceOpenNowFields } from "@/components/discovery/price-open-now-fields";

export interface MapFiltersState {
  // Opcional a propósito (Fase 1 de la fusión de buscadores, sin RF
  // asociado — ver CLAUDE.md sección 45): /buscar reusa PriceOpenNowFields
  // para precio/abierto-ahora sin este sheet — su radio de "cerca de ti"
  // es fijo, no un filtro que el usuario elija.
  radiusKm?: number;
  priceMin: string;
  priceMax: string;
  openNow: boolean;
}

interface MapFiltersSheetProps {
  filters: MapFiltersState;
  onChange: (filters: MapFiltersState) => void;
  showRadius: boolean;
  onClose: () => void;
  /** Modo sencillo/avanzado (Fase 3, CLAUDE.md sección 48) — ver PriceOpenNowFields#showPrice. */
  showPrice: boolean;
}

const RADIUS_OPTIONS = [2, 5, 10];

/**
 * Panel de filtros combinables del mapa (distancia, precio, "abierto
 * ahora") — `openNow` viaja tal cual al backend (GET
 * /businesses/nearby|/businesses `openNow=true`), el cálculo real contra
 * horarios y la hora actual lo hace el servidor
 * (disponibilidad.service.js); acá nunca se inventa ese booleano
 * comparando horas en el cliente.
 *
 * Sube como "bottom sheet" desde el botón secundario "Filtros" del
 * FloatingActionStack (ver CLAUDE.md, sección FloatingActionStack) — ya
 * no es una barra siempre visible arriba del mapa: la sección 17 de
 * CLAUDE.md pide expandir en el mismo lugar en vez de dejar controles
 * permanentes ocupando espacio de pantalla. `PriceOpenNowFields` (precio
 * mín./máx. + abierto ahora) se extrajo para reusarse también en
 * `/buscar` (Fase 1, sección 45) — este componente sigue siendo el único
 * que agrega el selector de radio y la posición de "bottom sheet" fijo
 * al contenedor del mapa.
 *
 * La distancia solo tiene sentido con una coordenada de referencia
 * (GET /businesses/nearby) — sin geolocalización concedida se oculta, no
 * se muestra deshabilitada, para no prometer un filtro que no hace nada.
 */
export function MapFiltersSheet({ filters, onChange, showRadius, onClose, showPrice }: MapFiltersSheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] px-3 pb-3">
      <div className="relative rounded-card border border-border bg-surface p-4 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar filtros"
          className="absolute -top-3 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text shadow"
        >
          <X size={16} weight="bold" />
        </button>

        <h2 className="mb-3 font-heading text-title-2 font-semibold text-text">Filtros</h2>

        <div className="flex flex-wrap items-end gap-3">
          {showRadius && (
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-body-sm font-medium text-text">Distancia</span>
              <select
                value={filters.radiusKm}
                onChange={(event) => onChange({ ...filters, radiusKm: Number(event.target.value) })}
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
            onChange={(next) => onChange({ ...filters, ...next })}
            showPrice={showPrice}
          />
        </div>
      </div>
    </div>
  );
}

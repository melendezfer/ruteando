"use client";

import { TextField } from "@/components/ui/text-field";

export interface MapFiltersState {
  radiusKm: number;
  priceMin: string;
  priceMax: string;
  openNow: boolean;
}

interface MapFiltersProps {
  filters: MapFiltersState;
  onChange: (filters: MapFiltersState) => void;
  showRadius: boolean;
}

const RADIUS_OPTIONS = [2, 5, 10];

/**
 * Filtros combinables del mapa (CLAUDE.md sección 18, Épica F3): distancia,
 * rango de precio y "abierto ahora". `openNow` viaja tal cual al backend
 * (GET /businesses/nearby|/businesses `openNow=true`) — el cálculo real
 * contra horarios y la hora actual lo hace el servidor
 * (disponibilidad.service.js, Épica 4); acá nunca se inventa ese booleano
 * comparando horas en el cliente.
 *
 * La distancia solo tiene sentido con una coordenada de referencia
 * (GET /businesses/nearby) — sin geolocalización concedida se oculta, no
 * se muestra deshabilitada, para no prometer un filtro que no hace nada.
 */
export function MapFilters({ filters, onChange, showRadius }: MapFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-4 py-3">
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

      <div className="w-24">
        <TextField
          label="Precio mín."
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.priceMin}
          onChange={(event) => onChange({ ...filters, priceMin: event.target.value })}
        />
      </div>

      <div className="w-24">
        <TextField
          label="Precio máx."
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.priceMax}
          onChange={(event) => onChange({ ...filters, priceMax: event.target.value })}
        />
      </div>

      <button
        type="button"
        aria-pressed={filters.openNow}
        onClick={() => onChange({ ...filters, openNow: !filters.openNow })}
        className={`h-btn shrink-0 whitespace-nowrap rounded-full px-4 font-sans text-body-sm font-medium transition-colors ${
          filters.openNow
            ? "bg-terracota text-white"
            : "border border-border bg-surface text-text hover:bg-background"
        }`}
      >
        Abierto ahora
      </button>
    </div>
  );
}

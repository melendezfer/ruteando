"use client";

import { Fragment } from "react";
import { TextField } from "@/components/ui/text-field";

export interface PriceOpenNowState {
  priceMin: string;
  priceMax: string;
  openNow: boolean;
}

interface PriceOpenNowFieldsProps {
  value: PriceOpenNowState;
  onChange: (value: PriceOpenNowState) => void;
}

/**
 * Precio mín./máx. + "abierto ahora" — extraído de MapFiltersSheet (Fase
 * 1 de la fusión de buscadores, sin RF asociado — ver CLAUDE.md sección
 * 45) para reusarse también en `/buscar`, que no tiene el mismo
 * contenedor de alto fijo que el mapa: ahí estos campos se expanden
 * in-place bajo la barra de búsqueda (CLAUDE.md sección 17), no como un
 * "bottom sheet" anclado al viewport — MapFiltersSheet sigue siendo
 * quien decide esa posición para el mapa, envolviendo este mismo
 * componente junto con el selector de radio.
 *
 * Sin div contenedor propio a propósito (un `Fragment`) — cada caller ya
 * tiene su propio `flex flex-wrap` (MapFiltersSheet lo comparte con el
 * selector de radio; el panel inline de /buscar lo usa solo) y anidar
 * otro contenedor flex-wrap adentro cambiaría en qué unidad envuelven
 * los controles.
 */
export function PriceOpenNowFields({ value, onChange }: PriceOpenNowFieldsProps) {
  return (
    <Fragment>
      <div className="w-24">
        <TextField
          label="Precio mín."
          type="number"
          min={0}
          inputMode="numeric"
          value={value.priceMin}
          onChange={(event) => onChange({ ...value, priceMin: event.target.value })}
        />
      </div>

      <div className="w-24">
        <TextField
          label="Precio máx."
          type="number"
          min={0}
          inputMode="numeric"
          value={value.priceMax}
          onChange={(event) => onChange({ ...value, priceMax: event.target.value })}
        />
      </div>

      <button
        type="button"
        aria-pressed={value.openNow}
        onClick={() => onChange({ ...value, openNow: !value.openNow })}
        className={`h-btn shrink-0 whitespace-nowrap rounded-full px-4 font-sans text-body-sm font-medium transition-colors ${
          value.openNow
            ? "bg-terracota text-white"
            : "border border-border bg-surface text-text hover:bg-background"
        }`}
      >
        Abierto ahora
      </button>
    </Fragment>
  );
}

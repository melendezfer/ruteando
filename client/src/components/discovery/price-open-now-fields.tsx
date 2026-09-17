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
  /**
   * Modo sencillo/avanzado (Fase 3 de la fusión de buscadores, sin RF
   * asociado — ver CLAUDE.md sección 48): en modo sencillo, los campos
   * de precio no se muestran — "abierto ahora" sigue disponible en los
   * dos modos, no es un filtro de precio. Default `true` (siempre
   * visibles) para no romper otros usos futuros de este componente que
   * no pasen este prop.
   */
  showPrice?: boolean;
}

/**
 * Precio mín./máx. + "abierto ahora" — extraído originalmente del panel
 * "Filtros" del mapa (Fase 1 de la fusión de buscadores, sin RF asociado
 * — ver CLAUDE.md sección 45) para reusarse también en `/buscar`, donde
 * estos campos se expanden in-place bajo la barra de búsqueda (CLAUDE.md
 * sección 17). Desde la Fase B de la retroalimentación sobre el
 * buscador (sección 51), el mapa dejó de tener un panel "Filtros"
 * separado — `MapSearchSheet` es ahora quien envuelve este mismo
 * componente (junto con el selector de radio) dentro de la hoja de
 * búsqueda unificada.
 *
 * Sin div contenedor propio a propósito (un `Fragment`) — cada caller ya
 * tiene su propio `flex flex-wrap` (MapSearchSheet lo comparte con el
 * selector de radio; el panel inline de /buscar lo usa solo) y anidar
 * otro contenedor flex-wrap adentro cambiaría en qué unidad envuelven
 * los controles.
 */
export function PriceOpenNowFields({ value, onChange, showPrice = true }: PriceOpenNowFieldsProps) {
  return (
    <Fragment>
      {showPrice && (
        <>
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
        </>
      )}

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

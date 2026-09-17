"use client";

interface SearchModeToggleProps {
  advanced: boolean;
  onChange: (advanced: boolean) => void;
}

/**
 * "Sencilla" / "Avanzada" (Fase 3 de la fusión de buscadores, petición
 * directa del usuario, sin RF asociado — ver CLAUDE.md sección 45/48):
 * decide si se muestran precios — los campos de precio mín./máx. en el
 * panel de filtros (PriceOpenNowFields#showPrice) y el monto de cada
 * producto coincidente en los resultados (MatchReasonBadges#showPrices).
 * "Abierto ahora"/distancia/categoría no dependen de este modo, solo lo
 * que es específicamente sobre precio.
 *
 * Segmentado (dos botones), no un checkbox — mismo criterio que
 * MobilityToggle (CLAUDE.md sección 36): una elección entre dos estados
 * excluyentes, ninguno "apagado" por defecto. Sin persistencia (ni
 * localStorage ni cuenta del usuario) — estado local de cada pantalla,
 * vuelve a "Sencilla" en cada visita; no se pidió recordarlo.
 */
export function SearchModeToggle({ advanced, onChange }: SearchModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Modo de búsqueda"
      className="inline-flex shrink-0 gap-0.5 rounded-full border border-border bg-background p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!advanced}
        onClick={() => onChange(false)}
        className={`rounded-full px-3 py-1.5 font-sans text-body-sm font-medium transition-colors ${
          !advanced ? "bg-terracota text-white" : "text-text-muted hover:text-text"
        }`}
      >
        Sencilla
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={advanced}
        onClick={() => onChange(true)}
        className={`rounded-full px-3 py-1.5 font-sans text-body-sm font-medium transition-colors ${
          advanced ? "bg-terracota text-white" : "text-text-muted hover:text-text"
        }`}
      >
        Avanzada
      </button>
    </div>
  );
}

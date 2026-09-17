"use client";

import { ArrowRight, MapTrifold } from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";
import { describeVariety, estimateWalkingMinutes } from "@/lib/zones/zone-format";

type BusinessZone = components["schemas"]["BusinessZone"];

interface ZoneComparisonCardProps {
  zones: BusinessZone[];
  onJumpToZone: (zone: BusinessZone) => void;
}

/**
 * "Zonas de aglomeración" (ver CLAUDE.md sección 32, sin RF asociado) —
 * la comparación entre zonas cercanas: "si el usuario está en una zona
 * con poca variedad, sugiere la zona más cercana con más opciones".
 *
 * `zones` ya viene ordenado por distancia ascendente (GET
 * /businesses/zones) — la primera es la zona más cercana al punto de
 * búsqueda (proxy razonable de "la zona en la que está el consumidor",
 * sin necesitar un concepto aparte de "estoy DENTRO de una zona"; ver el
 * trade-off en CLAUDE.md). `betterZone` es la siguiente zona más cercana
 * con estrictamente MÁS variedad que la actual — si no existe ninguna
 * (la más cercana ya es la más variada, o solo hay una zona), este
 * componente no renderiza nada: no hay nada que sugerir.
 *
 * Siempre `top-3` — hasta la Fase B de la retroalimentación sobre el
 * buscador (sin RF asociado, ver CLAUDE.md sección 51) esta tarjeta
 * necesitaba un prop `belowSearchBar` para esquivar la caja de búsqueda
 * fija del mapa (con un offset medido a mano que se rompió dos veces,
 * Fases 1 y 3). Esa caja ya no existe — el buscador vive en una hoja
 * inferior (`MapSearchSheet`), así que no hay nada arriba que esquivar.
 */
export function ZoneComparisonCard({ zones, onJumpToZone }: ZoneComparisonCardProps) {
  if (zones.length === 0) return null;

  const currentZone = zones[0];
  const betterZone = zones
    .slice(1)
    .find((zone) => (zone.categoryCount ?? 0) > (currentZone.categoryCount ?? 0));

  if (!betterZone) return null;

  const minutes = estimateWalkingMinutes(betterZone.distanceMeters ?? 0);

  return (
    <div className="absolute left-3 right-3 top-3 z-30 rounded-card border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-2">
        <MapTrifold size={20} weight="duotone" className="mt-0.5 shrink-0 text-mostaza" />
        <p className="font-sans text-body-sm text-text">
          Estás cerca de una zona con {describeVariety(currentZone.categoryCount ?? 0)}. A ~{minutes} min
          caminando hay una zona con {describeVariety(betterZone.categoryCount ?? 0)}.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onJumpToZone(betterZone)}
        className="mt-2 flex items-center gap-1 font-sans text-body-sm font-semibold text-terracota"
      >
        Ver esa zona
        <ArrowRight size={16} weight="bold" />
      </button>
    </div>
  );
}

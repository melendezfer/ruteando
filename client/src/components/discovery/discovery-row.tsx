"use client";

import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { CATALOG_ICON_BY_TYPE, DEFAULT_CATALOG_ICON } from "@/lib/catalog/catalog-icons";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import { getCategoryPinColor } from "@/lib/map/category-pin-colors";
import { buildDirectionsUrl } from "@/lib/format/directions";
import { formatDistance } from "@/lib/format/distance";
import type { BusinessPin } from "@/components/map/leaflet-map";

/**
 * Wording de la acción de ubicación por tipo de negocio (petición
 * directa del usuario): un local fijo se "ve en el mapa" (una dirección
 * concreta); un ambulante "se ve" donde esté ahora (misma acción
 * técnica, wording honesto sobre que se mueve); un servicio se enmarca
 * como una zona que atiende, no un punto fijo al que "llegar".
 */
function resolveLocationActionLabel(business: BusinessPin, catalogType: CatalogType | null): string {
  if (catalogType === "services") return "Ver zona";
  return business.mobility === "fixed" ? "Ver en mapa" : "Ver ubicación";
}

interface DiscoveryRowProps {
  business: BusinessPin;
  catalogType: CatalogType | null;
  categoryName: string | null;
  onOpenDetail: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
  /**
   * Redediseño de navegación global (sin RF asociado, petición directa
   * del usuario) — "el ícono de familia" de cada fila (el círculo de
   * color de categoría) se vuelve tappable: navega a la lista filtrada
   * por esa `categoryId`. Sin esto (ej. dentro de la propia lista
   * filtrada por categoría, donde tocar el ícono otra vez no aporta
   * nada nuevo), el ícono queda como un `<span>` decorativo, no un
   * botón — mismo criterio que el resto del proyecto: sin acción, no se
   * finge un control interactivo.
   */
  onCategoryClick?: (business: BusinessPin) => void;
  /** Gancho extra antes de cada acción (el carrusel del banner lo usa para pausar el auto-avance; la lista filtrada no lo necesita). */
  onBeforeAction?: () => void;
}

/**
 * Fila compacta de negocio — una sola línea densa (ícono de categoría +
 * nombre + estado + distancia), con la categoría en texto y los accesos
 * ("Ver ubicación/en el mapa/zona" + "Cómo llegar") inmediatamente
 * debajo. Redediseño de navegación global (sin RF asociado, petición
 * directa del usuario) — reemplaza a la vieja `DiscoveryBusinessRowContent`
 * de `discovery-banner.tsx` (3 líneas, ícono decorativo): esta es la
 * ÚNICA fila reusada tanto por el carrusel del banner (Nivel 1, dentro de
 * una tarjeta de ancho fijo) como por la vista de lista filtrada vertical
 * (ancho completo, sin carrusel) — un solo lugar evita que las dos
 * diverjan.
 *
 * El ícono de categoría es hermano del botón de "abrir detalle", no
 * anidado dentro (un `<button>` dentro de otro `<button>` sería HTML
 * inválido, mismo problema ya resuelto en `business-card.tsx` con
 * `FavoriteButton`/`product-row.tsx` con el badge de oferta) — con
 * `stopPropagation()` para que tocarlo no dispare también el detalle.
 */
export function DiscoveryRow({
  business,
  catalogType,
  categoryName,
  onOpenDetail,
  onViewOnMap,
  onCategoryClick,
  onBeforeAction,
}: DiscoveryRowProps) {
  const CategoryIcon = catalogType ? CATALOG_ICON_BY_TYPE[catalogType] : DEFAULT_CATALOG_ICON;
  const color = getCategoryPinColor(business.categoryId, catalogType);
  const statusText = business.availabilityConfirmedAt ? "Vendiendo ahora" : "Abierto";
  const locationLabel = resolveLocationActionLabel(business, catalogType);
  const hasCoords = typeof business.latitude === "number" && typeof business.longitude === "number";

  const categoryIcon = (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: color }}
    >
      <CategoryIcon size={18} weight="fill" />
    </span>
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        {onCategoryClick ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBeforeAction?.();
              onCategoryClick(business);
            }}
            aria-label={`Ver más ${categoryName ?? "de esta categoría"} cerca`}
            className="shrink-0 rounded-full transition-transform hover:scale-105"
          >
            {categoryIcon}
          </button>
        ) : (
          categoryIcon
        )}
        <button
          type="button"
          onClick={() => {
            onBeforeAction?.();
            onOpenDetail(business);
          }}
          aria-label={`Ver detalle de ${business.name ?? "este negocio"}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="truncate font-sans text-body-sm font-semibold text-text">{business.name}</span>
          <span className="shrink-0 font-sans text-caption text-text-muted">
            {statusText}
            {typeof business.distanceMeters === "number" ? ` · ${formatDistance(business.distanceMeters)}` : ""}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onBeforeAction?.();
          onOpenDetail(business);
        }}
        className="block w-full py-0.5 pl-[2.75rem] pr-3 text-left"
      >
        <span className="truncate font-sans text-caption text-text-muted">
          {categoryName ?? "Comercio informal"}
        </span>
      </button>

      <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            onBeforeAction?.();
            onViewOnMap(business);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 font-sans text-caption font-medium text-terracota"
        >
          <MapPin size={14} weight="bold" />
          {locationLabel}
        </button>
        {hasCoords && (
          <a
            href={buildDirectionsUrl(business.latitude, business.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onBeforeAction?.()}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 font-sans text-caption font-medium text-terracota"
          >
            <RuteandoLogo size={14} />
            Cómo llegar
          </a>
        )}
      </div>
    </div>
  );
}

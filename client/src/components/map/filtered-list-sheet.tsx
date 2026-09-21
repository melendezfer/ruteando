"use client";

import { useEffect, useState } from "react";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import type { ConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { sortAvailableNow } from "@/lib/discovery/available-now";
import { DiscoveryRow } from "@/components/discovery/discovery-row";
import { Skeleton } from "@/components/discovery/skeleton";
import type { BusinessPin } from "@/components/map/leaflet-map";

export type DiscoveryListFilter =
  | { type: "category"; categoryId: number }
  | { type: "offerType"; offerTypeId: number }
  | { type: "favorites" };

const LIST_LIMIT = 50;
const DEFAULT_RADIUS_KM = 5;

interface FilteredListSheetProps {
  filter: DiscoveryListFilter;
  /** Título ya resuelto por quien llama (map-screen.tsx ya tiene los nombres de categoría/tipo de oferta a mano) — este componente no vuelve a resolverlo. */
  title: string;
  categoryTypeById: Map<number, CatalogType>;
  categoryNameById: Map<number, string>;
  geolocation: ConsumerGeolocation;
  onSelectResult: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
  onClose: () => void;
}

/**
 * Vista de lista vertical filtrada (redediseño de navegación global, sin
 * RF asociado — petición directa del usuario): destino común de "tocar
 * un ícono → ver más" — el ícono de categoría de una fila del banner
 * (`categoryId`), el ícono de sección "Favoritos abiertos ahora"
 * (`favorites`, TODOS los favoritos, no solo los abiertos ahora — a
 * propósito, ver CLAUDE.md) y el badge de oferta con vigencia de
 * `ProductRow` (`offerType`, generaliza lo que antes vivía como filtro
 * de pines + aviso removible directo en `map-screen.tsx`, PR #78). Un
 * solo componente para los tres — "no dupliques la lógica tres veces",
 * mismo componente de fila (`DiscoveryRow`) que ya usa el carrusel del
 * banner, en columna en vez de carrusel.
 *
 * `favorites` es el único caso que NO pasa por `useBusinessSearch`
 * (`GET /businesses`/`/nearby`, sin concepto de "solo mis favoritos") —
 * usa `GET /users/me/favorites` directo, sin `openNow` (a diferencia del
 * banner, que sí lo aplica — acá se pidió expresamente TODOS los
 * favoritos). Ese endpoint no acepta lat/lng, así que no hay
 * `distanceMeters` real del backend — se ordena con el mismo criterio ya
 * usado para "Disponibles ahora"/"Favoritos abiertos ahora" en el banner
 * (`sortAvailableNow`, que ya tolera `distanceMeters` ausente).
 */
export function FilteredListSheet({
  filter,
  title,
  categoryTypeById,
  categoryNameById,
  geolocation,
  onSelectResult,
  onViewOnMap,
  onClose,
}: FilteredListSheetProps) {
  const [businesses, setBusinesses] = useState<BusinessPin[] | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setBusinesses(null);

      if (filter.type === "favorites") {
        const { data } = await api.GET("/users/me/favorites", { params: { query: { limit: LIST_LIMIT } } });
        const withCoords = (data?.data ?? []).filter(
          (b): b is BusinessPin => typeof b.latitude === "number" && typeof b.longitude === "number",
        );
        if (!ignore) setBusinesses(sortAvailableNow(withCoords));
        return;
      }

      const coords = geolocation.status === "granted" ? geolocation.coords : null;
      const commonQuery =
        filter.type === "category"
          ? { categoryId: filter.categoryId, limit: LIST_LIMIT }
          : { offerTypeId: filter.offerTypeId, limit: LIST_LIMIT };

      const { data } = coords
        ? await api.GET("/businesses/nearby", {
            params: { query: { lat: coords.lat, lng: coords.lng, radiusKm: DEFAULT_RADIUS_KM, ...commonQuery } },
          })
        : await api.GET("/businesses", { params: { query: commonQuery } });

      const withCoords = (data?.data ?? []).filter(
        (b): b is BusinessPin => typeof b.latitude === "number" && typeof b.longitude === "number",
      );
      if (!ignore) setBusinesses(withCoords);
    }

    load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.type, filter.type === "category" ? filter.categoryId : null, filter.type === "offerType" ? filter.offerTypeId : null, geolocation.status, geolocation.coords]);

  return (
    <div className="absolute inset-0 z-[1000] flex flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver al mapa"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <h2 className="flex-1 truncate font-heading text-title-2 font-semibold text-text">{title}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {businesses === null && (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {businesses !== null && businesses.length === 0 && (
          <p className="px-4 py-8 text-center font-sans text-body-sm text-text-muted">
            No encontramos negocios que coincidan.
          </p>
        )}

        {businesses !== null && businesses.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {businesses.map((business) => (
              <DiscoveryRow
                key={business.id}
                business={business}
                catalogType={business.categoryId != null ? (categoryTypeById.get(business.categoryId) ?? null) : null}
                categoryName={business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null}
                onOpenDetail={onSelectResult}
                onViewOnMap={onViewOnMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

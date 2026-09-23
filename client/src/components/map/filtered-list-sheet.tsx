"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, X } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";
import { resolveOfferTypeIcon } from "@/lib/catalog/offer-type-icons";
import type { Icon } from "@phosphor-icons/react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { resolveCatalogIcon } from "@/lib/catalog/catalog-icons";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import type { ConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { sortAvailableNow } from "@/lib/discovery/available-now";
import { DiscoveryRow } from "@/components/discovery/discovery-row";
import { OfferRow, type DiscoveryOffer } from "@/components/discovery/offer-row";
import { Skeleton } from "@/components/discovery/skeleton";
import type { BusinessPin } from "@/components/map/leaflet-map";

type OfferType = components["schemas"]["OfferType"];

export type DiscoveryListFilter =
  | { type: "available_now" }
  | { type: "active_offers" }
  | { type: "category"; categoryId: number }
  | { type: "offerType"; offerTypeId: number }
  | { type: "favorites" };

const LIST_LIMIT = 50;
const DEFAULT_RADIUS_KM = 5;

function filtersEqual(a: DiscoveryListFilter, b: DiscoveryListFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "category" && b.type === "category") return a.categoryId === b.categoryId;
  if (a.type === "offerType" && b.type === "offerType") return a.offerTypeId === b.offerTypeId;
  return true;
}

/** Clave estable de un filtro, para comparar identidad "durante el render" (ver `activeFilter` más abajo) sin depender de la identidad del objeto. */
function filterKey(f: DiscoveryListFilter): string {
  if (f.type === "category") return `category:${f.categoryId}`;
  if (f.type === "offerType") return `offerType:${f.offerTypeId}`;
  return f.type;
}

interface FilteredListSheetProps {
  /** Filtro con el que se abrió la hoja (ícono de categoría de una fila, badge de oferta, "Favoritos" de MainFloatingNav, o "Ver todas" del banner) — punto de partida, no fijo: la navegación horizontal entre familias de adentro puede cambiarlo sin recargar nada. */
  filter: DiscoveryListFilter;
  /** "Disponibles ahora" ya cargado por map-screen.tsx para el carrusel de arriba — se reusa acá tal cual, sin un fetch aparte. */
  availableNow: BusinessPin[];
  /**
   * "Cerca de ti ahora" (sin RF asociado, petición directa del usuario
   * — ver CLAUDE.md sección 54), ya cargado por map-screen.tsx (mismo
   * criterio que `availableNow`: sin fetch propio acá).
   */
  activeOffers: DiscoveryOffer[];
  categoryTypeById: Map<number, CatalogType>;
  categoryNameById: Map<number, string>;
  offerTypes: OfferType[];
  geolocation: ConsumerGeolocation;
  /** "📍 Ver en mapa"/"Ver ubicación"/"Ver zona" de cada fila — recentra el mapa y cierra esta hoja (ver map-screen.tsx#handleSelectFromSearch). */
  onViewOnMap: (business: BusinessPin) => void;
  onClose: () => void;
}

/**
 * Hoja inferior (bottom sheet) sobre el mapa — retroalimentación sobre el
 * redediseño de navegación global (sin RF asociado, petición directa del
 * usuario): reemplaza a la vista de lista de PANTALLA COMPLETA que tenía
 * antes este mismo componente (`absolute inset-0`, tapaba el mapa por
 * completo). Mismo patrón que `MapSearchSheet`/`BusinessSummarySheet`
 * (`absolute inset-x-0 bottom-0`, `max-h-[70vh]`) — el mapa, con el pin
 * de ubicación, se queda visible arriba.
 *
 * Navegación horizontal entre familias (pestañas con ícono, arriba de la
 * lista): "Disponibles ahora" (si hay), "Cerca de ti ahora" (si hay —
 * ofertas con vigencia, sin RF asociado, ver CLAUDE.md sección 54),
 * "Favoritos" (siempre), y la categoría/tipo de oferta específico con el
 * que se abrió la hoja (si aplica) — tocar una pestaña distinta cambia
 * la lista de abajo sin cerrar ni reabrir la hoja. "Disponibles ahora" y
 * "Cerca de ti ahora" reusan datos ya cargados por map-screen.tsx
 * (`availableNow`/`activeOffers`, sin fetch propio); "Favoritos" siempre
 * trae TODOS los favoritos (no solo los abiertos ahora — decisión ya
 * tomada, distinta a la del carrusel de arriba), y categoría/oferta
 * piden `GET /businesses/nearby` o `/businesses` según haya
 * geolocalización. "Cerca de ti ahora" muestra `OfferRow` (la oferta
 * como protagonista — plato/promoción/evento, negocio, distancia,
 * vigencia), no `DiscoveryRow` — es la única pestaña con una fila de
 * forma distinta.
 *
 * Tocar una fila navega al PERFIL COMPLETO (`/negocios/{id}`) — a
 * diferencia del carrusel de arriba y de los resultados de
 * `MapSearchSheet` (que abren `BusinessSummarySheet`, un resumen sin
 * navegar), acá el usuario ya está mirando una lista completa de una
 * familia: verificado en vivo que antes de este cambio no había ninguna
 * forma clara de llegar al perfil completo desde esta hoja.
 */
export function FilteredListSheet({
  filter,
  availableNow,
  activeOffers,
  categoryTypeById,
  categoryNameById,
  offerTypes,
  geolocation,
  onViewOnMap,
  onClose,
}: FilteredListSheetProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<DiscoveryListFilter>(filter);
  const [businesses, setBusinesses] = useState<BusinessPin[] | null>(null);

  // Si la hoja se reabre con un filtro NUEVO (ej. dos íconos tocados
  // seguidos sin cerrar) mientras este componente sigue montado, la
  // pestaña activa se reinicia al nuevo punto de entrada — ajustado
  // "durante el render" (patrón recomendado por React para derivar
  // estado de un prop que cambia), no en un efecto: evita el
  // renderizado en cascada que un `setState` síncrono dentro de un
  // efecto produciría.
  const [lastSyncedFilterKey, setLastSyncedFilterKey] = useState(filterKey(filter));
  if (filterKey(filter) !== lastSyncedFilterKey) {
    setLastSyncedFilterKey(filterKey(filter));
    setActiveFilter(filter);
  }

  // Pestañas disponibles: "Disponibles ahora" (si hay datos) + "Cerca de
  // ti ahora" (si hay datos, sin RF asociado — ver CLAUDE.md sección 54)
  // + "Favoritos" (siempre) + la categoría/oferta específica con la que
  // se abrió la hoja, si no es ya una de las fijas.
  const tabs = useMemo<DiscoveryListFilter[]>(() => {
    const list: DiscoveryListFilter[] = [];
    if (availableNow.length > 0) list.push({ type: "available_now" });
    if (activeOffers.length > 0) list.push({ type: "active_offers" });
    list.push({ type: "favorites" });
    if (filter.type === "category" || filter.type === "offerType") list.push(filter);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableNow.length, activeOffers.length, filter.type, filter.type === "category" ? filter.categoryId : null, filter.type === "offerType" ? filter.offerTypeId : null]);

  function tabLabel(tab: DiscoveryListFilter): string {
    if (tab.type === "available_now") return "Disponibles ahora";
    if (tab.type === "active_offers") return "Cerca de ti ahora";
    if (tab.type === "favorites") return "Favoritos";
    if (tab.type === "category") return categoryNameById.get(tab.categoryId) ?? "Categoría";
    return offerTypes.find((t) => t.id === tab.offerTypeId)?.name ?? "Oferta";
  }

  function tabIcon(tab: DiscoveryListFilter): Icon {
    // Registro único de íconos (lib/icons/semantic-icons.ts): "abierto
    // ahora" tiene su propio ícono (antes CheckCircle, compartido con
    // "confirmó que vende"); un tipo de oferta puntual usa SU ícono (Menú
    // = cubiertos, Promoción = porcentaje...), no el Tag genérico, que
    // queda solo para "Cerca de ti ahora" (cualquier oferta).
    if (tab.type === "available_now") return SEMANTIC_ICONS.openNow;
    if (tab.type === "favorites") return Heart;
    if (tab.type === "active_offers") return SEMANTIC_ICONS.offer;
    if (tab.type === "offerType") {
      return resolveOfferTypeIcon(offerTypes.find((t) => t.id === tab.offerTypeId)?.icon);
    }
    return resolveCatalogIcon(categoryTypeById.get(tab.categoryId));
  }

  // Ícono/nombre del tipo de oferta por id (sin RF asociado — ver
  // CLAUDE.md sección 54), solo para la pestaña "Cerca de ti ahora":
  // cada `OfferRow` necesita resolver su propio tipo, y un `.find()`
  // dentro de un `.map()` por cada oferta sería O(n·m) sin necesidad.
  const offerTypeById = useMemo(() => {
    const map = new Map<number, OfferType>();
    offerTypes.forEach((type) => {
      if (type.id !== undefined) map.set(type.id, type);
    });
    return map;
  }, [offerTypes]);

  const activeFilterKey = filterKey(activeFilter);

  useEffect(() => {
    let ignore = false;

    async function load() {
      // "Disponibles ahora" reusa lo ya cargado por map-screen.tsx —
      // sin fetch propio, sin parpadeo de skeleton.
      if (activeFilter.type === "available_now") {
        setBusinesses(availableNow);
        return;
      }

      // "Cerca de ti ahora" — mismo criterio, `activeOffers` ya viene
      // cargado por map-screen.tsx (prop, no `businesses`): no hay nada
      // que hacer acá, el JSX de abajo lee la prop directo.
      if (activeFilter.type === "active_offers") return;

      setBusinesses(null);

      if (activeFilter.type === "favorites") {
        const { data } = await api.GET("/users/me/favorites", { params: { query: { limit: LIST_LIMIT } } });
        const withCoords = (data?.data ?? []).filter(
          (b): b is BusinessPin => typeof b.latitude === "number" && typeof b.longitude === "number",
        );
        if (!ignore) setBusinesses(sortAvailableNow(withCoords));
        return;
      }

      const coords = geolocation.status === "granted" ? geolocation.coords : null;
      const commonQuery =
        activeFilter.type === "category"
          ? { categoryId: activeFilter.categoryId, limit: LIST_LIMIT }
          : { offerTypeId: activeFilter.offerTypeId, limit: LIST_LIMIT };

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
  }, [activeFilterKey, availableNow, geolocation.status, geolocation.coords]);

  /** Tocar una fila de esta hoja navega al perfil completo — verificado en vivo (petición directa del usuario) que antes no era claro cómo llegar ahí desde esta lista. */
  function handleOpenProfile(business: BusinessPin) {
    if (business.id) router.push(`/negocios/${business.id}`);
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] px-3 pb-3">
      <div className="relative flex max-h-[70vh] flex-col rounded-card border border-border bg-surface shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute -top-3 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text shadow"
        >
          <X size={16} weight="bold" />
        </button>

        <div className="flex gap-2 overflow-x-auto border-b border-border p-3 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const isActive = filtersEqual(tab, activeFilter);
            const TabIcon = tabIcon(tab);
            return (
              <button
                key={tabLabel(tab) + tab.type}
                type="button"
                onClick={() => setActiveFilter(tab)}
                aria-pressed={isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-body-sm font-medium transition-colors ${
                  isActive
                    ? "border-terracota bg-terracota text-white"
                    : "border-border bg-background text-text-muted hover:text-text"
                }`}
              >
                <TabIcon size={16} weight="bold" />
                {tabLabel(tab)}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeFilter.type === "active_offers" ? (
            activeOffers.length === 0 ? (
              <p className="px-4 py-8 text-center font-sans text-body-sm text-text-muted">
                No encontramos ofertas cerca.
              </p>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {activeOffers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    offerType={offer.offerTypeId != null ? (offerTypeById.get(offer.offerTypeId) ?? null) : null}
                    onOpenDetail={(selected) => handleOpenProfile(selected.business)}
                  />
                ))}
              </div>
            )
          ) : (
            <>
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
                      onOpenDetail={handleOpenProfile}
                      onViewOnMap={onViewOnMap}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { Crosshair, SlidersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { useBusinessSearch } from "@/lib/discovery/use-business-search";
import { Skeleton } from "@/components/discovery/skeleton";
import { SearchBar } from "@/components/discovery/search-bar";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { MapFiltersSheet, type MapFiltersState } from "@/components/map/map-filters";
import { MapSearchResults } from "@/components/map/map-search-results";
import { BusinessSummarySheet } from "@/components/map/business-summary-sheet";
import { ZoneComparisonCard } from "@/components/map/zone-comparison-card";
import type { BusinessPin } from "@/components/map/leaflet-map";
import type { CatalogType } from "@/lib/catalog/catalog-label";

type Category = components["schemas"]["Category"];
type BusinessZone = components["schemas"]["BusinessZone"];

// Centro de referencia de Ciudad Verde, Soacha (mismo punto que usa
// scripts/seedLoadTest.js en el backend) — solo se usa cuando el
// consumidor no concede geolocalización y todavía no hay ningún negocio
// real para calcular un centro a partir de sus coordenadas.
const DEFAULT_CENTER = { lat: 4.578, lng: -74.217 };
const MAP_RESULTS_LIMIT = 50;
const DEFAULT_MAP_RADIUS_KM = 5;
const LOCATE_ME_ZOOM = 16;
// Debe coincidir con la duración de la transición de
// `.f3-business-pin-inner` en globals.css — el popup de información
// (BusinessSummarySheet) se abre recién cuando el pin terminó de
// crecer, no al tocar.
const PIN_GROW_ANIMATION_MS = 220;

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((mod) => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  ),
});

/**
 * Vista de mapa (Épica F3, retrofit fix/mapa-floating-action-stack):
 * pines agrupados contra GET /businesses/nearby (o GET /businesses sin
 * geolocalización). Los controles ya no son una barra fija arriba del
 * mapa — el mismo FloatingActionStack de la Épica F4 (ver CLAUDE.md,
 * sección FloatingActionStack) reemplaza esos controles: "Mi ubicación"
 * como acción principal (recentra el mapa, o reintenta el permiso si
 * fue denegado) y "Filtros" como secundaria (abre el panel de
 * distancia/precio/abierto-ahora como bottom sheet, sección 17).
 */
export function MapScreen() {
  const geolocation = useConsumerGeolocation();
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  // Texto libre del buscador del mapa (Fase 1 de la fusión de
  // buscadores, sin RF asociado — ver CLAUDE.md sección 45): antes el
  // mapa no tenía ninguna caja de texto, solo los filtros de
  // precio/abierto-ahora/radio de abajo. `searchKey` fuerza un remount
  // de SearchBar (que maneja su propio input internamente, sin `value`
  // controlado) para limpiar visualmente el campo cuando se toca "Limpiar".
  const [query, setQuery] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  const [zones, setZones] = useState<BusinessZone[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  // Negocio recién tocado, mientras el pin todavía está en la animación
  // de crecimiento (ver PIN_GROW_ANIMATION_MS) — separado de `selected`
  // a propósito: `selected` es lo que abre BusinessSummarySheet, y el
  // pin debe empezar a crecer de inmediato al tocar, ANTES de que ese
  // popup aparezca, no al mismo tiempo.
  const [pendingSelection, setPendingSelection] = useState<BusinessPin | null>(null);
  const pendingSelectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MapFiltersState>({
    radiusKm: DEFAULT_MAP_RADIUS_KM,
    priceMin: "",
    priceMax: "",
    openNow: false,
  });

  useEffect(() => {
    let ignore = false;
    api.GET("/categories").then(({ data }) => {
      if (!ignore && data) setCategories(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.name !== undefined) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categories]);

  /** Para colorear cada pin por familia (ver category-pin-colors.ts) — el color de un negocio depende de `Category.type`, no solo de su `categoryId`. */
  const categoryTypeById = useMemo(() => {
    const map = new Map<number, CatalogType>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.type !== undefined) {
        map.set(category.id, category.type);
      }
    });
    return map;
  }, [categories]);

  const {
    businesses: rawBusinesses,
    loading,
    search,
  } = useBusinessSearch({
    limit: MAP_RESULTS_LIMIT,
    radiusKm: filters.radiusKm ?? DEFAULT_MAP_RADIUS_KM,
    geolocation,
  });

  const businesses = useMemo<BusinessPin[]>(
    () =>
      (rawBusinesses ?? []).filter(
        (business): business is BusinessPin =>
          typeof business.latitude === "number" && typeof business.longitude === "number",
      ),
    [rawBusinesses],
  );

  const runSearch = useCallback(() => {
    const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
    const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
    search({ q: query || undefined, priceMin, priceMax, openNow: filters.openNow });
  }, [search, query, filters.priceMin, filters.priceMax, filters.openNow]);

  function handleTextSearch(text: string) {
    setQuery(text);
  }

  function handleClearSearch() {
    setQuery("");
    setSearchKey((k) => k + 1);
  }

  /**
   * "Zonas de aglomeración" (ver CLAUDE.md sección 32) — solo se piden
   * con geolocalización concedida a propósito: sin un punto de
   * referencia real del consumidor, "la zona en la que estás" no
   * significa nada (mismo criterio que ZoneComparisonCard, que usa la
   * primera zona del resultado como proxy de "zona actual"). Sin
   * geolocalización, el mapa sigue mostrando pines individuales
   * normalmente — solo se pierde el resaltado de zonas y la
   * comparación, no la búsqueda en sí.
   */
  const loadZones = useCallback(async () => {
    const coords = geolocation.status === "granted" ? geolocation.coords : null;
    if (!coords) {
      setZones([]);
      return;
    }

    const { data } = await api.GET("/businesses/zones", {
      params: {
        query: {
          lat: coords.lat,
          lng: coords.lng,
          radiusKm: filters.radiusKm,
        },
      },
    });
    setZones(data ?? []);
  }, [geolocation.status, geolocation.coords, filters.radiusKm]);

  useEffect(() => {
    if (geolocation.status === "loading" || geolocation.status === "idle") return;
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        runSearch();
        loadZones();
      }
    });
    return () => {
      ignore = true;
    };
  }, [geolocation.status, runSearch, loadZones]);

  // "Cargando" de verdad hasta que se resuelva la PRIMERA búsqueda
  // (rawBusinesses === null) — `loading` del hook solo cubre mientras
  // una petición está en vuelo, no el instante entre montar y que
  // geolocation.status deje "loading"/"idle" y dispare el efecto de
  // arriba; sin esto, ese instante mostraría "No encontramos negocios"
  // en vez del skeleton.
  const showSkeleton = businesses.length === 0 && (loading || rawBusinesses === null);
  // Con `query` activo, MapSearchResults ya comunica "sin resultados"
  // para ese texto — no duplicar el mismo mensaje centrado sobre el mapa.
  const showEmptyState = !loading && rawBusinesses !== null && businesses.length === 0 && !query;

  let center = DEFAULT_CENTER;
  if (geolocation.status === "granted" && geolocation.coords) {
    center = geolocation.coords;
  } else if (businesses.length > 0) {
    center = { lat: businesses[0].latitude, lng: businesses[0].longitude };
  }

  const userLocation = geolocation.status === "granted" ? geolocation.coords : null;
  const showRadiusFilter = geolocation.status === "granted";
  const showLocationHint = geolocation.status !== "granted" && geolocation.status !== "loading" && geolocation.status !== "idle";

  function handleLocateMe() {
    if (geolocation.status === "granted" && geolocation.coords && mapInstanceRef.current) {
      mapInstanceRef.current.setView([geolocation.coords.lat, geolocation.coords.lng], LOCATE_ME_ZOOM, {
        animate: true,
      });
      return;
    }
    // Sin ubicación concedida (o todavía cargando): reintenta el permiso
    // — si el usuario lo otorga ahora, FitToResults en leaflet-map.tsx ya
    // reacciona solo a `userLocation` cambiando, sin lógica extra acá.
    geolocation.retry();
  }

  function handleSelectBusiness(business: BusinessPin) {
    setFiltersOpen(false);
    // El pin ya arranca a crecer acá (ver selectedBusinessId más abajo,
    // que combina pendingSelection y selected) — BusinessSummarySheet
    // recién se abre cuando esa animación termina.
    if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    setPendingSelection(business);
    pendingSelectionTimeoutRef.current = setTimeout(() => {
      setSelected(business);
      setPendingSelection(null);
      pendingSelectionTimeoutRef.current = null;
    }, PIN_GROW_ANIMATION_MS);
  }

  /**
   * Tocar un resultado de MapSearchResults (Fase 1, sección 45) — a
   * diferencia de tocar un pin ya visible, el negocio puede estar fuera
   * del encuadre actual o agrupado dentro de un cluster, así que primero
   * recentra el mapa sobre su coordenada (mismo zoom que "Mi ubicación")
   * y recién ahí dispara la misma selección que un pin.
   */
  function handleSelectFromSearch(business: BusinessPin) {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([business.latitude, business.longitude], LOCATE_ME_ZOOM, {
        animate: true,
      });
    }
    handleSelectBusiness(business);
  }

  useEffect(() => {
    return () => {
      if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    };
  }, []);

  /** "Ver esa zona" en ZoneComparisonCard — recentra el mapa sobre la zona sugerida, mismo zoom que "Mi ubicación". */
  function handleJumpToZone(zone: BusinessZone) {
    if (mapInstanceRef.current && zone.centerLatitude != null && zone.centerLongitude != null) {
      mapInstanceRef.current.setView([zone.centerLatitude, zone.centerLongitude], LOCATE_ME_ZOOM, {
        animate: true,
      });
    }
  }

  function handleToggleFilters() {
    if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    setPendingSelection(null);
    setSelected(null);
    setFiltersOpen((open) => !open);
  }

  return (
    // pb-24 a propósito: BottomNavBar (CLAUDE.md sección 27) es `fixed`,
    // así que no reserva espacio por sí sola en el flujo normal — sin este
    // padding, el borde inferior de este contenedor (de donde cuelgan
    // BusinessSummarySheet/MapFiltersSheet con `absolute bottom-0`, y
    // hasta el propio mapa de Leaflet) quedaría debajo de la barra fija,
    // no encima. FloatingActionStack no depende de esto — usa su propio
    // prop `aboveBottomNav` porque es `fixed`, no `absolute` dentro de
    // este contenedor.
    <div className="flex flex-1 flex-col pb-24">
      {showLocationHint && (
        <p className="bg-ambar/10 px-4 py-2 font-sans text-body-sm text-text-muted">
          No pudimos acceder a tu ubicación. Mostrando negocios de Ciudad Verde — toca el botón de ubicación para
          intentar de nuevo.
        </p>
      )}

      <div className="relative min-h-[420px] flex-1">
        {/*
          Wrapper `absolute inset-0` a propósito, no `h-full w-full`: un
          hijo en flujo normal (position:relative/static) dentro de un
          contenedor cuyo alto viene de flex-grow (flex-1) no resuelve de
          forma confiable `height:100%` en los navegadores reales — un
          límite conocido y documentado de Flexbox, no un bug de Tailwind
          ni de Leaflet (confirmado verificando contra un navegador real:
          el mismo `height:100%` en un hijo `position:absolute` sí
          resolvía, en uno `position:relative` no). `absolute inset-0`
          resuelve contra la caja de padding del ancestro posicionado más
          cercano por un algoritmo distinto, que sí es confiable acá.

          `isolate` es el segundo ajuste real encontrado retrofitando
          FloatingActionStack acá: Leaflet mueve sus paneles internos con
          `transform` (para paneo acelerado por GPU) y les asigna z-index
          propios (hasta 700) — sin aislar su contexto de apilamiento,
          esos paneles pueden pintarse por encima de un
          `position: fixed` hermano fuera de este div (el
          FloatingActionStack de más abajo), sin importar que su propio
          z-index sea menor: es un problema de qué contexto de
          apilamiento gana, no de qué número es más alto. `isolate`
          contiene TODO el apilamiento interno de Leaflet dentro de este
          div — hacia afuera, el div compite como una sola unidad según
          el orden del documento, así que el FloatingActionStack (que
          viene después en el JSX) vuelve a ganar de forma confiable.
        */}
        <div className="absolute inset-0 isolate">
          {showSkeleton ? (
            <div className="flex h-full w-full flex-col gap-2 p-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <LeafletMap
              center={center}
              userLocation={userLocation}
              businesses={businesses}
              categoryTypeById={categoryTypeById}
              zones={zones}
              selectedBusinessId={pendingSelection?.id ?? selected?.id ?? null}
              onSelectBusiness={handleSelectBusiness}
              onMapReady={(map) => {
                mapInstanceRef.current = map;
              }}
            />
          )}
        </div>

        {/*
          Buscador de texto (Fase 1, CLAUDE.md sección 45) — siempre
          visible arriba del mapa, mismo lugar que ocupa en /buscar.
          `bg-surface` + `shadow-lg` para que se lea sobre los tiles del
          mapa, mismo lenguaje visual que MapFiltersSheet.
        */}
        <div className="absolute inset-x-3 top-3 z-[1000] flex items-start gap-2 rounded-card border border-border bg-surface p-3 shadow-lg">
          <div className="flex-1">
            <SearchBar key={searchKey} onSearch={handleTextSearch} />
          </div>
          {query && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Limpiar búsqueda"
              className="mt-7 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-muted hover:bg-background"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>

        {!selected && !filtersOpen && (
          <MapSearchResults
            query={query}
            results={businesses}
            loading={loading}
            categoryNameById={categoryNameById}
            onSelect={handleSelectFromSearch}
          />
        )}

        {showEmptyState && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <p className="rounded-card bg-surface px-4 py-3 text-center font-sans text-body-sm text-text-muted shadow">
              No encontramos negocios que coincidan con estos filtros.
            </p>
          </div>
        )}

        {!selected && !filtersOpen && !query && (
          <ZoneComparisonCard zones={zones} onJumpToZone={handleJumpToZone} belowSearchBar />
        )}

        {selected && (
          <BusinessSummarySheet
            business={selected}
            categoryName={selected.categoryId != null ? (categoryNameById.get(selected.categoryId) ?? null) : null}
            onClose={() => setSelected(null)}
          />
        )}

        {filtersOpen && (
          <MapFiltersSheet
            filters={filters}
            onChange={setFilters}
            showRadius={showRadiusFilter}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        {!selected && !filtersOpen && (
          <FloatingActionStack
            aboveBottomNav
            primary={{
              icon: <Crosshair size={26} weight="fill" />,
              label: "Mi ubicación",
              onClick: handleLocateMe,
            }}
            secondary={{
              icon: <SlidersHorizontal size={20} weight="bold" />,
              label: "Filtros",
              onClick: handleToggleFilters,
            }}
          />
        )}
      </div>
    </div>
  );
}

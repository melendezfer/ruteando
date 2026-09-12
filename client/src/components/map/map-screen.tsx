"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { Crosshair, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { Skeleton } from "@/components/discovery/skeleton";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { MapFiltersSheet, type MapFiltersState } from "@/components/map/map-filters";
import { BusinessSummarySheet } from "@/components/map/business-summary-sheet";
import type { BusinessPin } from "@/components/map/leaflet-map";

type Category = components["schemas"]["Category"];

// Centro de referencia de Ciudad Verde, Soacha (mismo punto que usa
// scripts/seedLoadTest.js en el backend) — solo se usa cuando el
// consumidor no concede geolocalización y todavía no hay ningún negocio
// real para calcular un centro a partir de sus coordenadas.
const DEFAULT_CENTER = { lat: 4.578, lng: -74.217 };
const MAP_RESULTS_LIMIT = 50;
const LOCATE_ME_ZOOM = 16;

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
  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MapFiltersState>({
    radiusKm: 5,
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

  const loadBusinesses = useCallback(async () => {
    setLoading(true);

    const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
    const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
    const coords = geolocation.status === "granted" ? geolocation.coords : null;

    const { data } = coords
      ? await api.GET("/businesses/nearby", {
          params: {
            query: {
              lat: coords.lat,
              lng: coords.lng,
              radiusKm: filters.radiusKm,
              limit: MAP_RESULTS_LIMIT,
              ...(priceMin !== undefined ? { priceMin } : {}),
              ...(priceMax !== undefined ? { priceMax } : {}),
              ...(filters.openNow ? { openNow: true } : {}),
            },
          },
        })
      : await api.GET("/businesses", {
          params: {
            query: {
              limit: MAP_RESULTS_LIMIT,
              ...(priceMin !== undefined ? { priceMin } : {}),
              ...(priceMax !== undefined ? { priceMax } : {}),
              ...(filters.openNow ? { openNow: true } : {}),
            },
          },
        });

    const pins = (data?.data ?? []).filter(
      (business): business is BusinessPin =>
        typeof business.latitude === "number" && typeof business.longitude === "number",
    );
    setBusinesses(pins);
    setLoading(false);
  }, [geolocation.status, geolocation.coords, filters]);

  useEffect(() => {
    if (geolocation.status === "loading" || geolocation.status === "idle") return;
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) loadBusinesses();
    });
    return () => {
      ignore = true;
    };
  }, [geolocation.status, loadBusinesses]);

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
    setSelected(business);
  }

  function handleToggleFilters() {
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
          {loading && businesses.length === 0 ? (
            <div className="flex h-full w-full flex-col gap-2 p-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <LeafletMap
              center={center}
              userLocation={userLocation}
              businesses={businesses}
              selectedBusinessId={selected?.id ?? null}
              onSelectBusiness={handleSelectBusiness}
              onMapReady={(map) => {
                mapInstanceRef.current = map;
              }}
            />
          )}
        </div>

        {!loading && businesses.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <p className="rounded-card bg-surface px-4 py-3 text-center font-sans text-body-sm text-text-muted shadow">
              No encontramos negocios que coincidan con estos filtros.
            </p>
          </div>
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

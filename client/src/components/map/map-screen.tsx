"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { Skeleton } from "@/components/discovery/skeleton";
import { MapFilters, type MapFiltersState } from "@/components/map/map-filters";
import { BusinessSummarySheet } from "@/components/map/business-summary-sheet";
import type { BusinessPin } from "@/components/map/leaflet-map";

type Category = components["schemas"]["Category"];

// Centro de referencia de Ciudad Verde, Soacha (mismo punto que usa
// scripts/seedLoadTest.js en el backend) — solo se usa cuando el
// consumidor no concede geolocalización y todavía no hay ningún negocio
// real para calcular un centro a partir de sus coordenadas.
const DEFAULT_CENTER = { lat: 4.578, lng: -74.217 };
const MAP_RESULTS_LIMIT = 50;

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((mod) => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  ),
});

/**
 * Vista de mapa (Épica F3, CLAUDE.md sección 18): pines agrupados contra
 * GET /businesses/nearby (o GET /businesses sin geolocalización), con
 * filtros combinables de distancia/precio/abierto-ahora y la tarjeta
 * resumen desplegándose in-place al tocar un pin (BusinessSummarySheet).
 */
export function MapScreen() {
  const geolocation = useConsumerGeolocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
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

  return (
    <div className="flex flex-1 flex-col">
      <MapFilters filters={filters} onChange={setFilters} showRadius={showRadiusFilter} />

      {geolocation.status !== "granted" && geolocation.status !== "loading" && geolocation.status !== "idle" && (
        <p className="bg-ambar/10 px-4 py-2 font-sans text-body-sm text-text-muted">
          No pudimos acceder a tu ubicación. Mostrando negocios de Ciudad Verde — activa tu ubicación para ver
          los más cercanos a ti primero.
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
        */}
        <div className="absolute inset-0">
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
              onSelectBusiness={setSelected}
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
      </div>
    </div>
  );
}

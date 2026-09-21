"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import type { ConsumerGeolocation } from "@/lib/geo/use-geolocation";

type Business = components["schemas"]["Business"];

export interface BusinessSearchFilters {
  q?: string;
  categoryId?: number;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  /**
   * Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado
   * — ver CLAUDE.md, migración productos-tipo-oferta. Solo negocios con
   * al menos un producto vigente de este tipo — ver
   * Business.matchedOfferType.
   */
  offerTypeId?: number;
}

interface UseBusinessSearchOptions {
  limit: number;
  /** Fijo (HomeScreen) o controlado por el usuario (MapScreen, ver MapSearchSheet) — solo importa con geolocalización concedida. */
  radiusKm: number;
  /**
   * La instancia de useConsumerGeolocation() que ya tiene montada el
   * caller — este hook NO llama a useConsumerGeolocation() por su
   * cuenta, para no terminar con dos peticiones de geolocalización
   * independientes (dos llamadas a getCurrentPosition, potencialmente
   * con coordenadas ligeramente distintas) compitiendo dentro de la
   * misma pantalla.
   */
  geolocation: ConsumerGeolocation;
}

/**
 * Fetch compartido por /buscar (home-screen.tsx) y el mapa (map-screen.tsx)
 * — Fase 1 de la fusión de buscadores (sin RF asociado, ver CLAUDE.md
 * sección 45): antes cada pantalla duplicaba la misma elección entre
 * GET /businesses y GET /businesses/nearby según geolocalización, con su
 * propia lista de parámetros armada a mano. Un solo lugar decide eso
 * ahora; cada pantalla sigue dueña de su propio estado de filtros/UI
 * (categorías rápidas, panel de filtros, etc.) y de qué hace con el
 * resultado (event logging, filtrar a solo los que tienen coordenadas
 * para el mapa...).
 */
export function useBusinessSearch({ limit, radiusKm, geolocation }: UseBusinessSearchOptions) {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (filters: BusinessSearchFilters) => {
      setLoading(true);

      const coords = geolocation.status === "granted" ? geolocation.coords : null;
      const commonQuery = {
        limit,
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.categoryId !== undefined ? { categoryId: filters.categoryId } : {}),
        ...(filters.priceMin !== undefined ? { priceMin: filters.priceMin } : {}),
        ...(filters.priceMax !== undefined ? { priceMax: filters.priceMax } : {}),
        ...(filters.openNow ? { openNow: true } : {}),
        ...(filters.offerTypeId !== undefined ? { offerTypeId: filters.offerTypeId } : {}),
      };

      const { data } = coords
        ? await api.GET("/businesses/nearby", {
            params: { query: { lat: coords.lat, lng: coords.lng, radiusKm, ...commonQuery } },
          })
        : await api.GET("/businesses", { params: { query: commonQuery } });

      const results = data?.data ?? [];
      setBusinesses(results);
      setLoading(false);
      return results;
    },
    [geolocation.status, geolocation.coords, limit, radiusKm],
  );

  return { businesses, setBusinesses, loading, search };
}

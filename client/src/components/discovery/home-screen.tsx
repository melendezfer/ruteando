"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { useBusinessSearch } from "@/lib/discovery/use-business-search";
import { logSearchEvent } from "@/lib/api/events";
import { CategoryChips } from "@/components/discovery/category-chips";
import { SearchBar } from "@/components/discovery/search-bar";
import { BusinessCard } from "@/components/discovery/business-card";
import { Skeleton } from "@/components/discovery/skeleton";
import { PriceOpenNowFields, type PriceOpenNowState } from "@/components/discovery/price-open-now-fields";

type Category = components["schemas"]["Category"];

const NEARBY_RADIUS_KM = 5;
const LIST_LIMIT = 6;
const EMPTY_FILTERS: PriceOpenNowState = { priceMin: "", priceMax: "", openNow: false };

interface HomeScreenProps {
  userFirstName: string;
}

interface LastSearch {
  query?: string;
  categoryId?: number;
  title: string;
}

/**
 * Pantalla de Inicio del consumidor (Épica F2, CLAUDE.md sección 18):
 * pregunta clara arriba, barra de búsqueda, categorías rápidas y una lista
 * corta "cerca de ti" — sin scroll infinito (Documento 08 sección 5.4.1):
 * `LIST_LIMIT` es un tope fijo, no hay "cargar más" ni paginación acá.
 *
 * No distingue por rol (`consumer`/`vendor`) a propósito: nada en la
 * especificación pide una Home distinta para vendedores todavía, y
 * cualquier usuario autenticado puede querer buscar un negocio como
 * consumidor.
 */
export function HomeScreen({ userFirstName }: HomeScreenProps) {
  const geolocation = useConsumerGeolocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [listTitle, setListTitle] = useState("Cerca de ti");
  // Último query/categoryId disparado por el usuario (texto o chip) — se
  // reusa al cambiar los filtros de precio/abierto-ahora (Fase 1 de la
  // fusión de buscadores, sin RF asociado — ver CLAUDE.md sección 45),
  // para no perder "en qué búsqueda estoy" solo porque se ajustó un
  // filtro encima.
  const [lastSearch, setLastSearch] = useState<LastSearch>({ title: "Cerca de ti" });
  // Precio mín./máx. + "abierto ahora" (Fase 1) — se expanden in-place
  // bajo la barra de búsqueda (CLAUDE.md sección 17), no como un "bottom
  // sheet" fijo al viewport como en el mapa: acá no hay un contenedor de
  // alto fijo del que anclarse, es una página normal con scroll.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PriceOpenNowState>(EMPTY_FILTERS);

  const { businesses, loading: listLoading, search } = useBusinessSearch({
    limit: LIST_LIMIT,
    radiusKm: NEARBY_RADIUS_KM,
    geolocation,
  });

  useEffect(() => {
    let cancelled = false;
    api.GET("/categories").then(({ data }) => {
      if (cancelled) return;
      if (data) setCategories(data);
      setCategoriesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    (params: LastSearch) => {
      setLastSearch(params);
      setListTitle(params.title);
      const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
      const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
      search({
        q: params.query,
        categoryId: params.categoryId,
        priceMin,
        priceMax,
        openNow: filters.openNow,
      });
    },
    [search, filters.priceMin, filters.priceMax, filters.openNow],
  );

  // Cambiar un filtro (precio/abierto-ahora) reusa el último query/categoría
  // — no dispara logSearchEvent (CLAUDE.md sección 16 solo lo pide "al
  // ejecutar una búsqueda por texto o categoría", un filtro no es eso).
  const refineWithFilters = useCallback(
    (nextFilters: PriceOpenNowState) => {
      setFilters(nextFilters);
      const priceMin = nextFilters.priceMin ? Number(nextFilters.priceMin) : undefined;
      const priceMax = nextFilters.priceMax ? Number(nextFilters.priceMax) : undefined;
      search({
        q: lastSearch.query,
        categoryId: lastSearch.categoryId,
        priceMin,
        priceMax,
        openNow: nextFilters.openNow,
      });
    },
    [search, lastSearch.query, lastSearch.categoryId],
  );

  // Carga inicial de "cerca de ti" apenas se resuelve la geolocalización.
  // No dispara el evento `busqueda` — CLAUDE.md sección 16 solo lo pide
  // "al ejecutar una búsqueda por texto o categoría", y esto es el estado
  // inicial de la pantalla, no una búsqueda del usuario.
  useEffect(() => {
    if (geolocation.status !== "granted") return;
    let ignore = false;
    // El `.then()` mueve el disparo real de runSearch (que abre con un
    // par de setState síncronos) fuera de la fase síncrona del efecto —
    // el mismo motivo por el que las callbacks de getCurrentPosition en
    // use-geolocation.ts tampoco disparan react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (!ignore) runSearch({ title: "Cerca de ti" });
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.status]);

  function handleTextSearch(text: string) {
    setSelectedCategoryId(null);
    logSearchEvent({ query: text });
    runSearch({ query: text, title: `Resultados para "${text}"` });
  }

  function handleCategorySelect(categoryId: number | null) {
    setSelectedCategoryId(categoryId);

    if (categoryId == null) {
      if (geolocation.status === "granted") {
        runSearch({ title: "Cerca de ti" });
      } else {
        setLastSearch({ title: "Cerca de ti" });
        setListTitle("Cerca de ti");
      }
      return;
    }

    const category = categories.find((c) => c.id === categoryId);
    logSearchEvent({ categoryId });
    runSearch({ categoryId, title: category ? `Categoría: ${category.name}` : "Resultados" });
  }

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.name !== undefined) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categories]);

  const showLocationHint = geolocation.status !== "granted" && businesses === null && !listLoading;
  const filtersActive = Boolean(filters.priceMin || filters.priceMax || filters.openNow);

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <h1 className="font-heading text-title-1 font-bold text-text">
        Hola, {userFirstName} — ¿qué estás buscando hoy?
      </h1>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SearchBar onSearch={handleTextSearch} />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-label="Filtros de precio y abierto ahora"
          aria-pressed={filtersOpen || filtersActive}
          className={`flex h-btn w-btn shrink-0 items-center justify-center rounded-full border ${
            filtersActive ? "border-terracota bg-terracota text-white" : "border-border bg-surface text-text"
          }`}
        >
          <SlidersHorizontal size={20} weight="bold" />
        </button>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3">
          <PriceOpenNowFields value={filters} onChange={refineWithFilters} />
        </div>
      )}

      <CategoryChips
        categories={categories}
        loading={categoriesLoading}
        selectedCategoryId={selectedCategoryId}
        onSelect={handleCategorySelect}
      />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-title-2 font-semibold text-text">{listTitle}</h2>

        {showLocationHint && (
          <p className="font-sans text-body-sm text-text-muted">
            Activa tu ubicación para ver negocios cerca de ti, o busca por nombre o categoría arriba.
          </p>
        )}

        {listLoading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {!listLoading && businesses !== null && businesses.length === 0 && (
          <p className="font-sans text-body-sm text-text-muted">
            No encontramos negocios que coincidan. Prueba con otro nombre, categoría o filtro.
          </p>
        )}

        {!listLoading &&
          businesses !== null &&
          businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              categoryName={
                business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null
              }
            />
          ))}
      </div>
    </div>
  );
}

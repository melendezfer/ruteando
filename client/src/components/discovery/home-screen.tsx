"use client";

import { useCategoriesWithStatus } from "@/lib/categories/use-categories";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { useBusinessSearch } from "@/lib/discovery/use-business-search";
import { logSearchEvent } from "@/lib/api/events";
import { CategoryChips } from "@/components/discovery/category-chips";
import { SearchBar } from "@/components/discovery/search-bar";
import { SearchModeToggle } from "@/components/discovery/search-mode-toggle";
import { BusinessCard } from "@/components/discovery/business-card";
import { Skeleton } from "@/components/discovery/skeleton";
import { PriceOpenNowFields, type PriceOpenNowState } from "@/components/discovery/price-open-now-fields";


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

  // Caché compartida de categorías (PR 3 de 3), no un fetch propio.
  const { categories, loading: categoriesLoading } = useCategoriesWithStatus();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [listTitle, setListTitle] = useState("Cerca de ti");
  // Último query/categoryId disparado por el usuario (texto o chip) — se
  // reusa al cambiar los filtros de precio/abierto-ahora (Fase 1 de la
  // fusión de buscadores, sin RF asociado — ver CLAUDE.md sección 45),
  // para no perder "en qué búsqueda estoy" solo porque se ajustó un
  // filtro encima.
  const [lastSearch, setLastSearch] = useState<LastSearch>({ title: "Cerca de ti" });
  // Precio mín./máx. + "abierto ahora" (Fase 1) — siempre visibles
  // in-place bajo la barra de búsqueda (CLAUDE.md sección 17), sin un
  // botón "Filtros" aparte que abrir/cerrar (retroalimentación sobre el
  // buscador, Fase B, sin RF asociado — ver CLAUDE.md sección 51): es la
  // propia pestaña "Avanzada" la que revela precio mín./máx.
  // (PriceOpenNowFields#showPrice) — "Abierto ahora" ya estaba disponible
  // en los dos modos y sigue igual.
  const [filters, setFilters] = useState<PriceOpenNowState>(EMPTY_FILTERS);
  // Sencilla/avanzada (Fase 3, sin RF asociado — ver CLAUDE.md sección
  // 48): decide si se muestran precios — los campos de precio del panel
  // de filtros y el monto en los chips de "por qué coincidió". Default
  // "sencilla", sin persistencia.
  const [advanced, setAdvanced] = useState(false);

  const { businesses, loading: listLoading, search } = useBusinessSearch({
    limit: LIST_LIMIT,
    radiusKm: NEARBY_RADIUS_KM,
    geolocation,
  });

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

  /**
   * Volver a "Sencilla" limpia cualquier filtro de precio ya aplicado
   * (Fase 3, sección 48) — sin esto, un precio elegido en modo avanzado
   * seguiría filtrando los resultados en silencio aunque el panel ya no
   * muestre esos campos.
   */
  function handleModeChange(next: boolean) {
    setAdvanced(next);
    if (!next && (filters.priceMin || filters.priceMax)) {
      refineWithFilters({ ...filters, priceMin: "", priceMax: "" });
    }
  }

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

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <SearchBar onSearch={handleTextSearch} userFirstName={userFirstName} />

      <SearchModeToggle advanced={advanced} onChange={handleModeChange} />

      <div className="flex flex-wrap items-end gap-3">
        <PriceOpenNowFields value={filters} onChange={refineWithFilters} showPrice={advanced} />
      </div>

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
              showPrices={advanced}
            />
          ))}
      </div>
    </div>
  );
}

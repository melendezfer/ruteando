"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { logSearchEvent } from "@/lib/api/events";
import { CategoryChips } from "@/components/discovery/category-chips";
import { SearchBar } from "@/components/discovery/search-bar";
import { BusinessCard } from "@/components/discovery/business-card";
import { Skeleton } from "@/components/discovery/skeleton";

type Business = components["schemas"]["Business"];
type Category = components["schemas"]["Category"];

const NEARBY_RADIUS_KM = 5;
const LIST_LIMIT = 6;

interface HomeScreenProps {
  userFirstName: string;
}

interface RunSearchOptions {
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

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listTitle, setListTitle] = useState("Cerca de ti");

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
    async ({ query, categoryId, title }: RunSearchOptions) => {
      setListLoading(true);
      setListTitle(title);

      const coords = geolocation.status === "granted" ? geolocation.coords : null;

      const { data } = coords
        ? await api.GET("/businesses/nearby", {
            params: {
              query: {
                lat: coords.lat,
                lng: coords.lng,
                radiusKm: NEARBY_RADIUS_KM,
                limit: LIST_LIMIT,
                ...(query ? { q: query } : {}),
                ...(categoryId !== undefined ? { categoryId } : {}),
              },
            },
          })
        : await api.GET("/businesses", {
            params: {
              query: {
                limit: LIST_LIMIT,
                ...(query ? { q: query } : {}),
                ...(categoryId !== undefined ? { categoryId } : {}),
              },
            },
          });

      setBusinesses(data?.data ?? []);
      setListLoading(false);
    },
    [geolocation.status, geolocation.coords],
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
  }, [geolocation.status, runSearch]);

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
        setBusinesses(null);
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
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6">
      <h1 className="font-heading text-title-1 font-bold text-text">
        Hola, {userFirstName} — ¿qué se te antoja hoy?
      </h1>

      <SearchBar onSearch={handleTextSearch} />

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
            No encontramos negocios que coincidan. Prueba con otro nombre o categoría.
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

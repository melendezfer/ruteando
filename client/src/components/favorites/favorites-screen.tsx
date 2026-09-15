"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";
import { BusinessCard } from "@/components/discovery/business-card";
import { useFavorites } from "@/lib/favorites/favorites-context";

type Business = components["schemas"]["Business"];
type Category = components["schemas"]["Category"];

// Sin "cargar más" a propósito (Documento 08 sección 5.4.1, "sin scroll
// infinito") — mismo criterio que HomeScreen/MapScreen: un límite fijo
// generoso en vez de paginación real, razonable para la cantidad de
// favoritos que alguien acumula en la práctica.
const FAVORITES_LIMIT = 50;

/**
 * GET /users/me/favorites — con la acción de marcar/desmarcar ya
 * construida (RF-017/Épica F8, FavoriteButton en business-card.tsx y
 * business-profile-screen.tsx). Reutiliza BusinessCard tal cual (Épica
 * F2/F3), con su propio patrón de expandir in-place.
 *
 * La lista visible se filtra contra el Set compartido de
 * FavoritesContext (`isFavorite`), no directamente contra `businesses`
 * (la respuesta cruda de este fetch) — así, desmarcar un favorito desde
 * cualquier tarjeta de ESTA misma pantalla (o quedarse en ella tras
 * desmarcarlo) lo hace desaparecer de inmediato, sin depender de volver
 * a navegar para refrescar. Antes de que ese contexto termine de cargar
 * (`isLoaded`), se muestra `businesses` sin filtrar — filtrar contra un
 * Set todavía vacío mostraría la lista vacía un instante y luego
 * "aparecería" de golpe, un parpadeo real que no aporta nada (en la
 * práctica casi nunca ocurre: FavoritesProvider ya carga apenas hay
 * sesión, mucho antes de que alguien navegue hasta acá).
 *
 * Antes vivía como pestaña dentro de /perfil (Épica F6); se promovió a
 * pantalla propia (`/favoritos`) al construir `BottomNavBar` (CLAUDE.md
 * sección 27) — Favoritos pasó a ser uno de los 4 destinos de primer
 * nivel, no una sub-sección de Perfil.
 */
export function FavoritesScreen() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const { isFavorite, isLoaded: favoritesLoaded } = useFavorites();

  useEffect(() => {
    let ignore = false;
    api.GET("/categories").then(({ data }) => {
      if (!ignore && data) setCategories(data);
    });
    api.GET("/users/me/favorites", { params: { query: { limit: FAVORITES_LIMIT } } }).then(({ data }) => {
      if (!ignore) setBusinesses(data?.data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.name !== undefined) map.set(category.id, category.name);
    });
    return map;
  }, [categories]);

  const visibleBusinesses = useMemo(() => {
    if (!businesses) return null;
    if (!favoritesLoaded) return businesses;
    return businesses.filter((business) => isFavorite(business.id));
  }, [businesses, favoritesLoaded, isFavorite]);

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <h1 className="font-heading text-title-1 font-bold text-text">Favoritos</h1>

      {visibleBusinesses === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {visibleBusinesses !== null && visibleBusinesses.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-10 text-center">
          <p className="font-sans text-body text-text">Todavía no tienes negocios favoritos guardados.</p>
          <p className="font-sans text-body-sm text-text-muted">
            Explora el{" "}
            <Link href="/" className="font-medium text-terracota underline">
              mapa
            </Link>{" "}
            o busca en{" "}
            <Link href="/buscar" className="font-medium text-terracota underline">
              Buscar
            </Link>{" "}
            para encontrar tus lugares preferidos.
          </p>
        </div>
      )}

      {visibleBusinesses !== null && visibleBusinesses.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleBusinesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              categoryName={
                business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

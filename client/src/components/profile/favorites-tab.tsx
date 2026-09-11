"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";
import { BusinessCard } from "@/components/discovery/business-card";

type Business = components["schemas"]["Business"];
type Category = components["schemas"]["Category"];

// Sin "cargar más" a propósito (Documento 08 sección 5.4.1, "sin scroll
// infinito") — mismo criterio que HomeScreen/MapScreen: un límite fijo
// generoso en vez de paginación real, razonable para la cantidad de
// favoritos que alguien acumula en la práctica.
const FAVORITES_LIMIT = 50;

/**
 * GET /users/me/favorites — de solo lectura (CLAUDE.md sección 18, F6):
 * marcar/desmarcar favoritos es la Épica F8, todavía no construida, así
 * que acá no hay ningún botón de corazón. Reutiliza BusinessCard tal
 * cual (Épica F2/F3), con su propio patrón de expandir in-place.
 */
export function FavoritesTab() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

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

  if (businesses === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-10 text-center">
        <p className="font-sans text-body text-text">Todavía no tienes negocios favoritos guardados.</p>
        <p className="font-sans text-body-sm text-text-muted">
          Explora el{" "}
          <Link href="/mapa" className="font-medium text-terracota underline">
            mapa
          </Link>{" "}
          o busca en{" "}
          <Link href="/" className="font-medium text-terracota underline">
            Inicio
          </Link>{" "}
          para encontrar tus lugares preferidos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {businesses.map((business) => (
        <BusinessCard
          key={business.id}
          business={business}
          categoryName={
            business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null
          }
        />
      ))}
    </div>
  );
}

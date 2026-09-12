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
 * GET /users/me/favorites — de solo lectura (marcar/desmarcar favoritos,
 * RF-017/Épica F8, todavía no está construido: no hay ningún botón de
 * corazón en ninguna pantalla todavía, así que esta lista hoy solo se
 * puebla si el backend ya tiene favoritos guardados de otra forma —
 * mismo estado que tenía como pestaña de /perfil, sin cambios de
 * funcionalidad, solo de ubicación). Reutiliza BusinessCard tal cual
 * (Épica F2/F3), con su propio patrón de expandir in-place.
 *
 * Antes vivía como pestaña dentro de /perfil (Épica F6); se promovió a
 * pantalla propia (`/favoritos`) al construir `BottomNavBar` (CLAUDE.md
 * sección 27) — Favoritos pasó a ser uno de los 4 destinos de primer
 * nivel, no una sub-sección de Perfil.
 */
export function FavoritesScreen() {
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

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <h1 className="font-heading text-title-1 font-bold text-text">Favoritos</h1>

      {businesses === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {businesses !== null && businesses.length === 0 && (
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
      )}

      {businesses !== null && businesses.length > 0 && (
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
      )}
    </div>
  );
}

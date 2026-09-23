"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type Category = components["schemas"]["Category"];

// Caché a nivel de módulo: GET /categories se pide UNA vez por sesión del
// navegador y todas las pantallas (mapa, buscar, banner, hoja, perfil,
// tarjetas) leen la misma lista — antes cada pantalla hacía su propio
// fetch y armaba sus propios mapas. Las categorías casi nunca cambian
// (se administran por migración), así que no hace falta invalidarla.
let cache: Category[] | null = null;
let pending: Promise<Category[]> | null = null;

function load(): Promise<Category[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api.GET("/categories").then(({ data }) => {
      cache = data ?? [];
      pending = null;
      return cache;
    });
  }
  return pending;
}

/** Lista de categorías + si todavía está cargando (para un skeleton). */
export function useCategoriesWithStatus(): { categories: Category[]; loading: boolean } {
  const [categories, setCategories] = useState<Category[] | null>(() => cache);
  useEffect(() => {
    let ignore = false;
    load().then((list) => {
      if (!ignore) setCategories(list);
    });
    return () => {
      ignore = true;
    };
  }, []);
  return { categories: categories ?? EMPTY, loading: categories === null };
}

const EMPTY: Category[] = [];

/** Lista de categorías (vacía mientras carga). */
export function useCategories(): Category[] {
  return useCategoriesWithStatus().categories;
}

/** Misma lista, indexada por id. */
export function useCategoriesById(): Map<number, Category> {
  const categories = useCategories();
  const [byId, setById] = useState(() => indexar(categories));
  const [origen, setOrigen] = useState(categories);
  // Ajuste durante el render (patrón recomendado por React para derivar
  // estado de un valor que cambia), no en un efecto.
  if (origen !== categories) {
    setOrigen(categories);
    setById(indexar(categories));
  }
  return byId;
}

function indexar(categories: Category[]): Map<number, Category> {
  const map = new Map<number, Category>();
  categories.forEach((c) => {
    if (c.id !== undefined) map.set(c.id, c);
  });
  return map;
}

"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { MapScreen } from "@/components/map/map-screen";
import type { DiscoveryListFilter } from "@/components/map/filtered-list-sheet";

/**
 * Pantalla real de nuevo (petición directa del usuario, sin RF asociado
 * — ver CLAUDE.md): antes del PR #41 esto era "/", y de ahí pasó a ser
 * solo un `redirect("/")`. Con la pantalla de inicio por rol, "/" ya no
 * es siempre el mapa (un vendedor con un negocio activo aterriza en su
 * propio perfil) — sin esta ruta, un vendedor perdería toda forma de
 * llegar al mapa. Por el mismo motivo, "Ver en el mapa" (Fase 4 de la
 * fusión de buscadores, CLAUDE.md sección 49) apunta acá y no a "/".
 *
 * Redediseño de navegación global (sin RF asociado, petición directa
 * del usuario): ya no monta `AppHeader`/`BottomNavBar` — `MapScreen`
 * monta su propia navegación flotante (`MainFloatingNav`) y el logo fijo
 * de marca.
 *
 * `useSearchParams()` exige un límite `Suspense` (Next.js, mismo
 * patrón que /restablecer-contrasena) — el componente real vive en
 * `MapaPageContent`, separado solo por eso.
 */
export default function MapaPage() {
  return (
    <Suspense>
      <MapaPageContent />
    </Suspense>
  );
}

function MapaPageContent() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId") ?? undefined;
  const categoryIdParam = searchParams.get("categoryId");
  const offerTypeIdParam = searchParams.get("offerTypeId");
  const favoritesOnlyParam = searchParams.get("favoritesOnly");

  // Redediseño de navegación global (sin RF asociado, petición directa
  // del usuario): un objeto NUEVO en cada render (aunque los valores no
  // cambien) rompería la sincronización en `MapScreen` (que compara por
  // referencia para distinguir "la URL trajo un filtro nuevo" de "el
  // usuario cerró el sheet a mano") — `useMemo`, con los valores
  // primitivos como deps, mantiene la misma referencia mientras la URL
  // no cambie de verdad.
  const initialListFilter = useMemo<DiscoveryListFilter | undefined>(() => {
    if (categoryIdParam) return { type: "category", categoryId: Number(categoryIdParam) };
    if (offerTypeIdParam) return { type: "offerType", offerTypeId: Number(offerTypeIdParam) };
    if (favoritesOnlyParam === "true") return { type: "favorites" };
    return undefined;
  }, [categoryIdParam, offerTypeIdParam, favoritesOnlyParam]);

  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <MapScreen initialBusinessId={businessId} initialListFilter={initialListFilter} />
      </main>
    </RequireAuth>
  );
}

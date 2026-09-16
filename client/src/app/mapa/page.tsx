"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { MapScreen } from "@/components/map/map-screen";

/**
 * Pantalla real de nuevo (petición directa del usuario, sin RF asociado
 * — ver CLAUDE.md): antes del PR #41 esto era "/", y de ahí pasó a ser
 * solo un `redirect("/")`. Con la pantalla de inicio por rol, "/" ya no
 * es siempre el mapa (un vendedor con un negocio activo aterriza en su
 * propio perfil) — sin esta ruta, un vendedor perdería toda forma de
 * llegar al mapa desde la barra de navegación inferior, que ahora
 * apunta acá (BottomNavBar) en vez de "/".
 */
export default function MapaPage() {
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <AppHeader />
        <MapScreen />
        <BottomNavBar />
      </main>
    </RequireAuth>
  );
}

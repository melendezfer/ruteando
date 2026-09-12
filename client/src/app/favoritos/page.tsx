"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { FavoritesScreen } from "@/components/favorites/favorites-screen";

/**
 * Ruta nueva (CLAUDE.md sección 27) — "Favoritos" pasa de ser una
 * pestaña dentro de /perfil (Épica F6) a su propio destino de primer
 * nivel en `BottomNavBar`.
 */
export default function FavoritesPage() {
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <AppHeader />
        <FavoritesScreen />
        <BottomNavBar />
      </main>
    </RequireAuth>
  );
}

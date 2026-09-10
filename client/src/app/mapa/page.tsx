"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { MapScreen } from "@/components/map/map-screen";

export default function MapaPage() {
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <AppHeader activeTab="mapa" />
        <MapScreen />
      </main>
    </RequireAuth>
  );
}

"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { MapScreen } from "@/components/map/map-screen";

export default function Home() {
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

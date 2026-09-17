"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { MapScreen } from "@/components/map/map-screen";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { VendorBusinessPicker } from "@/components/discovery/vendor-business-picker";
import { useVendorActiveBusinesses } from "@/lib/vendor/use-vendor-active-businesses";

/**
 * "/" por rol (petición directa del usuario, sin RF asociado — ver
 * CLAUDE.md): un consumidor (o administrador) sigue viendo el mapa
 * exactamente igual que desde el PR #41. Un vendedor con exactamente un
 * negocio ACTIVO aterriza directo en su perfil — sin ninguno, se queda
 * en el mapa (mandarlo a /negocios/nuevo en automático empujaría a crear
 * un segundo negocio si ya tiene uno pendiente/rechazado, justo el
 * problema real ya documentado en CLAUDE.md sección 34).
 *
 * "active" es la única condición que cuenta a propósito — un negocio
 * pending/rejected/suspended/closed no redirige (decisión explícita del
 * usuario, no asumida).
 */
export function HomeScreenRouter() {
  const router = useRouter();
  const activeBusinesses = useVendorActiveBusinesses();

  useEffect(() => {
    if (activeBusinesses?.length === 1 && activeBusinesses[0].id) {
      router.replace(`/negocios/${activeBusinesses[0].id}`);
    }
  }, [activeBusinesses, router]);

  // No vendedor, o vendedor sin ningún negocio activo: el mapa de
  // siempre. `activeBusinesses === null` (todavía cargando, solo pasa
  // para un vendedor) también cae acá — evita un parpadeo de mapa antes
  // de redirigir cuando sí hay exactamente uno.
  if (activeBusinesses?.length === 0) {
    return (
      <main className="flex flex-1 flex-col">
        <AppHeader />
        <MapScreen />
        <BottomNavBar />
      </main>
    );
  }

  if (activeBusinesses && activeBusinesses.length > 1) {
    return <VendorBusinessPicker businesses={activeBusinesses} />;
  }

  // Cargando, o a punto de redirigir (exactamente uno) — mismo lenguaje
  // visual que RequireAuth mientras resuelve la sesión.
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <RuteandoLogo size={48} />
      <p className="font-sans text-body text-text-muted">Buscando tu negocio…</p>
    </main>
  );
}

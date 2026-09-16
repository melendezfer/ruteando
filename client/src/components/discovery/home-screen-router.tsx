"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { MapScreen } from "@/components/map/map-screen";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

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
  const { user } = useAuth();
  const router = useRouter();
  const isVendor = user?.role === "vendor";

  const [activeBusinesses, setActiveBusinesses] = useState<Business[] | null>(null);

  useEffect(() => {
    if (!isVendor) return;
    let ignore = false;
    api.GET("/users/me/businesses", { params: { query: { limit: 50 } } }).then(({ data }) => {
      if (ignore) return;
      setActiveBusinesses((data?.data ?? []).filter((b) => b.status === "active"));
    });
    return () => {
      ignore = true;
    };
  }, [isVendor]);

  useEffect(() => {
    if (activeBusinesses?.length === 1 && activeBusinesses[0].id) {
      router.replace(`/negocios/${activeBusinesses[0].id}`);
    }
  }, [activeBusinesses, router]);

  // No vendedor, o vendedor sin ningún negocio activo: el mapa de
  // siempre. `activeBusinesses === null` (todavía cargando, solo pasa
  // para un vendedor) también cae acá — evita un parpadeo de mapa antes
  // de redirigir cuando sí hay exactamente uno.
  if (!isVendor || activeBusinesses?.length === 0) {
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

// Solo llega acá con negocios ya filtrados a status "active" (ver
// HomeScreenRouter) — no hace falta mostrar el estado en cada fila,
// siempre sería el mismo.
function VendorBusinessPicker({ businesses }: { businesses: Business[] }) {
  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <h1 className="font-heading text-title-1 font-bold text-text">
          ¿Cuál de tus negocios quieres ver?
        </h1>
        <div className="flex flex-col gap-2">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/negocios/${business.id}`}
              className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 hover:bg-background"
            >
              <span className="font-sans text-body font-medium text-text">{business.name}</span>
              <CaretRight size={18} className="text-text-muted" />
            </Link>
          ))}
        </div>
      </div>
      <BottomNavBar />
    </main>
  );
}

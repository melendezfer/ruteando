"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapTrifold } from "@phosphor-icons/react/dist/ssr";
import { MapScreen } from "@/components/map/map-screen";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { RegisterBusinessCard } from "@/components/business/register-business-card";
import { useAuth } from "@/lib/auth/auth-context";
import { useVendorHomeBusiness } from "@/lib/vendor/use-vendor-home-business";

/**
 * Pantalla de inicio (`/`) por rol. Consumidor/administrador: el mapa.
 * Vendedor (pedido del usuario, 2026-09-29): su página principal es su
 * negocio — el de la hora actual si tiene varios (useVendorHomeBusiness);
 * sin ninguno, "Registra tu negocio" destacado. Reemplaza el criterio de
 * CLAUDE.md §38 (solo negocios activos y un selector con 2+).
 */
export function HomeScreenRouter() {
  const { user } = useAuth();
  const router = useRouter();
  const homeBusiness = useVendorHomeBusiness();
  const isVendor = user?.role === "vendor";

  useEffect(() => {
    if (homeBusiness?.id) router.replace(`/negocios/${homeBusiness.id}`);
  }, [homeBusiness, router]);

  if (!isVendor) {
    return (
      <main className="flex flex-1 flex-col">
        <MapScreen />
      </main>
    );
  }

  if (homeBusiness === null) {
    return (
      <main className="flex flex-1 flex-col gap-4 bg-background px-5 py-6">
        <div className="flex items-center gap-2">
          <RuteandoLogo size={32} />
          <p className="font-sans text-body text-text-muted">Hola, {user?.fullName?.split(" ")[0] ?? "vendedor"}.</p>
        </div>
        <RegisterBusinessCard />
        <Link
          href="/mapa"
          className="flex min-h-11 items-center justify-center gap-2 font-sans text-body font-semibold text-terracota"
        >
          <MapTrifold size={18} weight="bold" />
          Mientras tanto, ver el mapa
        </Link>
        <MainFloatingNav />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <RuteandoLogo size={48} />
      <p className="font-sans text-body text-text-muted">Buscando tu negocio…</p>
    </main>
  );
}

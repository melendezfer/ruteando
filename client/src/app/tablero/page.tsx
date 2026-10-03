"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { TableroScreen } from "@/components/vendor/tablero-screen";
import { useVendorTodayBusinesses } from "@/lib/vendor/use-vendor-home-business";

/**
 * Tablero del día (Perfil 2.0 C2): la página principal del vendedor con
 * negocio — `/` y `/perfil` lo traen acá. Sin negocios (o si no es
 * vendedor), vuelve al inicio, que ofrece "Registra tu negocio" o el mapa.
 */
export default function TableroPage() {
  return (
    <RequireAuth>
      <TableroContent />
    </RequireAuth>
  );
}

function TableroContent() {
  const { user } = useAuth();
  const router = useRouter();
  const businesses = useVendorTodayBusinesses();
  const sinTablero = user?.role !== "vendor" || (businesses !== undefined && businesses.length === 0);

  useEffect(() => {
    if (sinTablero) router.replace("/");
  }, [sinTablero, router]);

  if (businesses === undefined || sinTablero) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <RuteandoLogo size={48} />
        <p className="font-sans text-body text-text-muted">Abriendo tu tablero…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <TableroScreen businesses={businesses} />
      <MainFloatingNav />
    </main>
  );
}

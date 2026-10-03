"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { ScreenHeader } from "@/components/layout/screen-header";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { RegisterBusinessCard } from "@/components/business/register-business-card";
import { useVendorHomeBusiness } from "@/lib/vendor/use-vendor-home-business";

/**
 * "Perfil" por rol, mismo criterio que `/` (home-screen-router.tsx): un
 * vendedor con negocio va a su negocio (el de la hora actual si tiene
 * varios); sin negocio, ve su cuenta con "Registra tu negocio" arriba.
 * Consumidor/administrador: su cuenta. `/cuenta` sigue siendo la cuenta sin
 * redirección (CLAUDE.md §43).
 */
export function ProfileScreenRouter() {
  const { user } = useAuth();
  const router = useRouter();
  const homeBusiness = useVendorHomeBusiness();
  const isVendor = user?.role === "vendor";

  useEffect(() => {
    if (homeBusiness?.id) router.replace("/tablero");
  }, [homeBusiness, router]);

  if (!user) return null;

  if (!isVendor || homeBusiness === null) {
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title="Mi perfil" />
        {isVendor && (
          <div className="reserva-columna pt-6 pl-5">
            <RegisterBusinessCard />
          </div>
        )}
        <ProfileScreen user={user} />
        <MainFloatingNav />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <RuteandoLogo size={48} />
      <p className="font-sans text-body text-text-muted">Abriendo tu tablero…</p>
    </main>
  );
}

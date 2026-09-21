"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { VendorBusinessPicker } from "@/components/discovery/vendor-business-picker";
import { useVendorActiveBusinesses } from "@/lib/vendor/use-vendor-active-businesses";

/**
 * "/perfil" por rol (petición directa del usuario, sin RF asociado — ver
 * CLAUDE.md sección 43): cierra el hueco real que dejó la sección 38 —
 * un vendedor con negocio activo que sale de él (a Mapa/Favoritos) no
 * tenía ninguna forma de volver desde la barra inferior, porque "Perfil"
 * siempre llevaba a la cuenta genérica y ningún destino apunta a "/".
 * Mismo criterio EXACTO que `HomeScreenRouter` en "/", reusando el mismo
 * hook (`useVendorActiveBusinesses`) y el mismo selector
 * (`VendorBusinessPicker`) para no duplicar la pregunta "¿cuál negocio
 * activo tiene este vendedor?" en dos lugares con lógica separada:
 *
 * - Sin negocio activo (consumidor, administrador, o vendedor sin
 *   ninguno todavía) — la cuenta de siempre, sin cambios.
 * - Exactamente un negocio activo — aterriza ahí directo.
 * - 2+ activos — el mismo selector que ya usa "/".
 *
 * La cuenta (contraseña, consentimientos, eliminar cuenta) sigue
 * accesible para un vendedor redirigido, vía un ícono nuevo dentro de
 * `business-profile-screen.tsx` que enlaza a `/cuenta` — una ruta
 * dedicada, sin este redirect, para no crear un ciclo (enlazar a
 * "/perfil" desde ahí solo devolvería al mismo negocio).
 */
export function ProfileScreenRouter() {
  const { user } = useAuth();
  const router = useRouter();
  const activeBusinesses = useVendorActiveBusinesses();

  useEffect(() => {
    if (activeBusinesses?.length === 1 && activeBusinesses[0].id) {
      router.replace(`/negocios/${activeBusinesses[0].id}`);
    }
  }, [activeBusinesses, router]);

  if (activeBusinesses?.length === 0) {
    if (!user) return null;
    return (
      <main className="flex flex-1 flex-col">
        <ProfileScreen user={user} />
        <MainFloatingNav />
      </main>
    );
  }

  if (activeBusinesses && activeBusinesses.length > 1) {
    return <VendorBusinessPicker businesses={activeBusinesses} />;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <RuteandoLogo size={48} />
      <p className="font-sans text-body text-text-muted">Buscando tu negocio…</p>
    </main>
  );
}

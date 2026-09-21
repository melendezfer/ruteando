"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { ProfileScreen } from "@/components/profile/profile-screen";

/**
 * Cuenta (contraseña, consentimientos, eliminar cuenta) sin el redirect
 * por rol de `/perfil` (sección 43, sin RF asociado — ver CLAUDE.md):
 * un vendedor con negocio activo, al que `/perfil` manda directo a su
 * negocio, necesita igual una forma de llegar a su cuenta — enlazar a
 * `/perfil` desde `business-profile-screen.tsx` solo lo devolvería al
 * mismo negocio (el redirect de esa ruta se dispara de nuevo). Esta
 * ruta es exactamente lo que rendía `/perfil` antes de la sección 43
 * (mismo patrón que `/mapa/page.tsx`, que restauró la pantalla real del
 * mapa cuando "/" dejó de serlo siempre).
 *
 * Redediseño de navegación global (sin RF asociado, petición directa
 * del usuario): `MainFloatingNav` (no `AppHeader`/`BottomNavBar`, que
 * desaparecieron de las 4 pantallas principales) — conceptualmente esta
 * ruta ES "Perfil" para un vendedor con negocio activo, así que lleva
 * la misma navegación que `/perfil`, no la vieja. Tocar "Perfil" desde
 * acá simplemente devuelve al vendedor a su negocio, comportamiento
 * esperado (mismo `router.push("/perfil")` de siempre).
 */
export default function CuentaPage() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      {user && (
        <main className="flex flex-1 flex-col">
          <ProfileScreen user={user} />
          <MainFloatingNav />
        </main>
      )}
    </RequireAuth>
  );
}

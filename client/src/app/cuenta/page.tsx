"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
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
 * `BottomNavBar` sí se monta acá (a diferencia de lo que se podría
 * suponer por no ser uno de los 4 destinos) — mismo motivo que llevó a
 * agregarla al perfil de negocio en la sección 42: sin ella, esta
 * pantalla sería un callejón sin salida más para un vendedor. Que
 * "Perfil" no quede resaltada acá (ningún href de la barra matchea
 * `/cuenta`) es aceptable, mismo criterio ya documentado en esa sección
 * — y tocar "Perfil" desde acá simplemente devuelve al vendedor a su
 * negocio, comportamiento esperado, no un bug nuevo.
 */
export default function CuentaPage() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      {user && (
        <main className="flex flex-1 flex-col">
          <AppHeader />
          <ProfileScreen user={user} />
          <BottomNavBar />
        </main>
      )}
    </RequireAuth>
  );
}

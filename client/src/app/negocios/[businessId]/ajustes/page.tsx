"use client";

import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { BusinessSettingsScreen } from "@/components/business/settings/business-settings-screen";

/**
 * Ajustes del negocio (Perfil 2.0, C3 — docs/specs/perfil-2.md §5). Solo
 * con sesión: la pantalla misma comprueba que quien entra sea el dueño
 * (el backend, además, rechaza con 403 cualquier cambio de otra persona).
 */
export default function BusinessSettingsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col bg-background">
        <BusinessSettingsScreen businessId={businessId} />
      </main>
    </RequireAuth>
  );
}

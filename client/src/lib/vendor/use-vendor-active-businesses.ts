"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

/**
 * Negocios ACTIVOS del vendedor autenticado (sin RF asociado, ver
 * CLAUDE.md) — extraído de `home-screen-router.tsx` (pantalla de inicio
 * por rol) para reusarlo también en `profile-screen-router.tsx` (perfil
 * por rol): las dos pantallas necesitan la misma pregunta ("¿cuál
 * negocio activo tiene este vendedor?") para decidir a dónde aterrizar.
 *
 * `null` mientras se resuelve (o si no aplica: no es vendedor — nunca
 * dispara el fetch), `[]` si es vendedor y no tiene ninguno activo.
 */
export function useVendorActiveBusinesses(): Business[] | null {
  const { user } = useAuth();
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

  return isVendor ? activeBusinesses : [];
}

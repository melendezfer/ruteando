"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import type { components } from "@/lib/api/schema";

export type TodayBusiness = components["schemas"]["TodayBusiness"];

/**
 * Negocios de hoy del vendedor, ya ordenados AHORA / DESPUÉS por el
 * servidor (GET /users/me/businesses/today, Perfil 2.0 §4.2/§7.5; antes el
 * orden se calculaba en el navegador con pickCurrentBusiness).
 * - `undefined` mientras se resuelve;
 * - `[]` si no es vendedor (sin fetch) o no tiene negocios (salvo cerrados).
 */
export function useVendorTodayBusinesses(): TodayBusiness[] | undefined {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const [result, setResult] = useState<TodayBusiness[] | undefined>(undefined);

  useEffect(() => {
    if (!isVendor) return;
    let ignore = false;
    api.GET("/users/me/businesses/today").then(({ data }) => {
      if (!ignore) setResult(data?.data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, [isVendor]);

  return isVendor ? result : [];
}

/**
 * ¿Tiene el vendedor algún negocio? Decide si su página principal es el
 * tablero (`/tablero`) o "Registra tu negocio". `undefined` mientras se
 * resuelve; `null` sin negocios o si no es vendedor.
 */
export function useVendorHomeBusiness(): TodayBusiness | null | undefined {
  const today = useVendorTodayBusinesses();
  if (today === undefined) return undefined;
  return today[0] ?? null;
}

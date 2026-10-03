"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { pickCurrentBusiness } from "@/lib/vendor/pick-current-business";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

/**
 * A dónde va la "página principal" de un vendedor (pedido del usuario,
 * 2026-09-29, que reemplaza el criterio de CLAUDE.md §38/§43):
 * - `undefined` mientras se resuelve;
 * - `null` si no es vendedor (sin fetch) o si no tiene ningún negocio (o
 *   solo cerrados): se le muestra "Registra tu negocio";
 * - el negocio de ahora (pickCurrentBusiness) si tiene uno o más, en
 *   CUALQUIER estado salvo cerrado — antes solo contaba "activo", y un
 *   vendedor recién registrado (negocio pendiente de aprobación) caía al
 *   mapa sin forma de llegar a su negocio.
 */
export function useVendorHomeBusiness(): Business | null | undefined {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const [result, setResult] = useState<Business | null | undefined>(undefined);

  useEffect(() => {
    if (!isVendor) return;
    let ignore = false;
    (async () => {
      const { data } = await api.GET("/users/me/businesses", { params: { query: { limit: 50 } } });
      const businesses = (data?.data ?? []).filter((b) => b.status !== "closed");
      if (businesses.length <= 1) {
        if (!ignore) setResult(businesses[0] ?? null);
        return;
      }
      const schedules = Object.fromEntries(
        await Promise.all(
          businesses.map(async (b) => {
            const { data: rows } = await api.GET("/businesses/{businessId}/schedule", {
              params: { path: { businessId: b.id! } },
            });
            return [b.id!, rows ?? []] as const;
          }),
        ),
      );
      if (!ignore) setResult(pickCurrentBusiness(businesses, schedules));
    })();
    return () => {
      ignore = true;
    };
  }, [isVendor]);

  return isVendor ? result : null;
}

import { api } from "@/lib/api/client";

/**
 * R5 — "Estoy vendiendo ahora" (docs/specs/r5-estoy-vendiendo.md). El
 * vendedor avisa por su cuenta; alimenta el mismo availabilityConfirmedAt
 * que responder "sí" a una pregunta.
 */
export const SELLING_NOW_FRESHNESS_MINUTES = 60; // AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES del backend

interface SellingNowResult {
  ok: boolean;
  status: number | undefined;
  /** `type` de Problem Details (RFC 9457), para distinguir "fuera de horario". */
  problemType: string | null;
  confirmedAt: string | null;
  saved: boolean;
}

/** PUT /businesses/{businessId}/selling-now — "Estoy vendiendo ahora" / "Sigo vendiendo". */
export async function confirmSellingNow(businessId: string): Promise<SellingNowResult> {
  const { data, error, response } = await api.PUT("/businesses/{businessId}/selling-now", {
    params: { path: { businessId } },
  });
  return {
    ok: response.ok,
    status: response.status,
    problemType: (error as { type?: string } | undefined)?.type ?? null,
    confirmedAt: data?.availabilityConfirmedAt ?? null,
    saved: data?.saved ?? false,
  };
}

/** DELETE /businesses/{businessId}/selling-now — "Ya no estoy vendiendo". Idempotente. */
export async function stopSellingNow(businessId: string): Promise<{ ok: boolean; status: number | undefined }> {
  const { response } = await api.DELETE("/businesses/{businessId}/selling-now", {
    params: { path: { businessId } },
  });
  return { ok: response.ok, status: response.status };
}

/** Cuándo vence un "vendiendo ahora" confirmado en `confirmedAt` (el servidor aplica la misma regla al leer). */
export function sellingNowExpiresAt(confirmedAt: string): number {
  return new Date(confirmedAt).getTime() + SELLING_NOW_FRESHNESS_MINUTES * 60_000;
}

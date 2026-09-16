import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type AvailabilityRequest = components["schemas"]["AvailabilityRequest"];

interface AvailabilityRequestResult {
  ok: boolean;
  status: number | undefined;
  request: AvailabilityRequest | null;
}

/** POST /businesses/{businessId}/availability-requests — Fase 2 de "vendiendo ahora" (CLAUDE.md sección 37). */
export async function requestAvailabilityCheck(businessId: string): Promise<AvailabilityRequestResult> {
  const { data, response } = await api.POST("/businesses/{businessId}/availability-requests", {
    params: { path: { businessId } },
  });
  return { ok: response.ok, status: response.status, request: data ?? null };
}

/**
 * GET /availability-requests/{requestId} — usado por el polling mientras
 * la solicitud sigue "pending" (ver availability-request-button.tsx).
 */
export async function getAvailabilityRequest(requestId: string): Promise<AvailabilityRequestResult> {
  const { data, response } = await api.GET("/availability-requests/{requestId}", {
    params: { path: { requestId } },
  });
  return { ok: response.ok, status: response.status, request: data ?? null };
}

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

interface AvailabilityRequestListResult {
  ok: boolean;
  status: number | undefined;
  requests: AvailabilityRequest[];
}

/**
 * GET /businesses/{businessId}/availability-requests?status=pending —
 * Fase 3 (panel del vendedor, VendorAvailabilityRequestsPanel). Solo
 * "pending": ni el panel ni este helper necesitan el historial completo
 * (confirmed/declined/expired), que el endpoint sí soporta del lado del
 * backend por si algún día hace falta.
 */
export async function listPendingAvailabilityRequests(
  businessId: string,
): Promise<AvailabilityRequestListResult> {
  const { data, response } = await api.GET("/businesses/{businessId}/availability-requests", {
    params: { path: { businessId }, query: { status: "pending" } },
  });
  return { ok: response.ok, status: response.status, requests: data?.data ?? [] };
}

/** PATCH /availability-requests/{requestId}/respond — Fase 3. */
export async function respondToAvailabilityRequest(
  requestId: string,
  decision: "confirmed" | "declined",
): Promise<AvailabilityRequestResult> {
  const { data, response } = await api.PATCH("/availability-requests/{requestId}/respond", {
    params: { path: { requestId } },
    body: { decision },
  });
  return { ok: response.ok, status: response.status, request: data ?? null };
}

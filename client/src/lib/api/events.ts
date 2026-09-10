import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type EventType = components["schemas"]["EventInput"]["type"];

/**
 * POST /events — analítica de mejor esfuerzo (CLAUDE.md sección 16).
 * Nunca debe romper la interacción del usuario si falla (red, 429 por
 * límite de tasa, etc.) — el error se traga en silencio a propósito,
 * nunca se propaga a quien llama.
 */
function logEvent(type: EventType, businessId?: string, metadata?: Record<string, unknown>): void {
  api
    .POST("/events", {
      body: {
        type,
        ...(businessId ? { businessId } : {}),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    })
    .catch(() => undefined);
}

interface LogSearchEventInput {
  query?: string;
  categoryId?: number;
}

/** Al ejecutar una búsqueda por texto o categoría (Épica F2). */
export function logSearchEvent(input: LogSearchEventInput): void {
  const metadata: Record<string, unknown> = {};
  if (input.query) metadata.query = input.query;
  if (input.categoryId !== undefined) metadata.categoryId = input.categoryId;
  logEvent("search", undefined, metadata);
}

/** Al abrir el perfil completo de un negocio (Épica F4). */
export function logBusinessViewEvent(businessId: string): void {
  logEvent("business_view", businessId);
}

/** Al expandir el detalle de un producto en el menú (Épica F4). */
export function logProductViewEvent(businessId: string, productId: string): void {
  logEvent("product_view", businessId, { productId });
}

/** Al tocar el botón de WhatsApp en el perfil (Épica F4). */
export function logContactClickEvent(businessId: string): void {
  logEvent("contact_click", businessId);
}

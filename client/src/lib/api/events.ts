import { api } from "@/lib/api/client";

interface LogSearchEventInput {
  query?: string;
  categoryId?: number;
}

/**
 * POST /events — analítica de mejor esfuerzo (CLAUDE.md sección 16: el
 * evento `busqueda` se dispara "al ejecutar una búsqueda por texto o
 * categoría"). Nunca debe romper la búsqueda del usuario si falla (red,
 * 429 por límite de tasa, etc.) — el error se traga en silencio a
 * propósito, no se propaga a quien llama.
 */
export function logSearchEvent(input: LogSearchEventInput): void {
  const metadata: Record<string, unknown> = {};
  if (input.query) metadata.query = input.query;
  if (input.categoryId !== undefined) metadata.categoryId = input.categoryId;

  api
    .POST("/events", {
      body: {
        type: "search",
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    })
    .catch(() => undefined);
}

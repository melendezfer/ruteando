import { api } from "@/lib/api/client";
import { getFieldErrors } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type Product = components["schemas"]["Product"];

export interface ProductInputBody {
  name: string;
  price: number;
  description?: string;
  available: boolean;
  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado
  // — ver CLAUDE.md, migración productos-tipo-oferta. Un producto de
  // catálogo normal omite los tres (undefined, no null — mismo criterio
  // que description: un PATCH que los omite conserva el valor existente).
  offerTypeId?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

interface ProductMutationResult {
  ok: boolean;
  product: Product | null;
  status: number | undefined;
  fieldErrors: Record<string, string>;
}

/**
 * Gestión del catálogo (agregar/editar/eliminar, sin épica de frontend
 * asignada hasta ahora — petición directa del usuario), consumiendo los
 * endpoints reales de la Épica 3 (`POST /businesses/{businessId}/products`,
 * `PATCH`/`DELETE /products/{productId}`) que ya existían sin ninguna UI
 * — mismo criterio de archivo que `photos.ts` con la carga de fotos.
 */
export async function createProduct(
  businessId: string,
  body: ProductInputBody,
): Promise<ProductMutationResult> {
  const { data, error, response } = await api.POST("/businesses/{businessId}/products", {
    params: { path: { businessId } },
    body,
  });
  return { ok: response.ok, product: data ?? null, status: response.status, fieldErrors: getFieldErrors(error) };
}

export async function updateProduct(
  productId: string,
  body: ProductInputBody,
): Promise<ProductMutationResult> {
  const { data, error, response } = await api.PATCH("/products/{productId}", {
    params: { path: { productId } },
    body,
  });
  return { ok: response.ok, product: data ?? null, status: response.status, fieldErrors: getFieldErrors(error) };
}

export async function deleteProduct(productId: string): Promise<{ ok: boolean; status: number | undefined }> {
  const { response } = await api.DELETE("/products/{productId}", {
    params: { path: { productId } },
  });
  return { ok: response.ok, status: response.status };
}

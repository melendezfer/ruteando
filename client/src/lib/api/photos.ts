import { api } from "@/lib/api/client";

/**
 * Forma reducida de Photo (id/url) que de verdad hace falta del lado del
 * cliente para "reemplazar" una foto — Photo (el schema generado) marca
 * TODAS sus propiedades como opcionales (openapi.yaml no declara
 * `required` en ese schema), así que `data.id`/`data.url` llegan tipados
 * como `string | undefined`; esta es la única función que hace esa
 * verificación, para no repetirla en cada componente que sube o
 * reemplaza una foto.
 */
export interface UploadedPhoto {
  id: string;
  url: string;
}

interface PhotoMutationResult {
  ok: boolean;
  photo: UploadedPhoto | null;
  status: number | undefined;
}

/**
 * openapi-fetch tipa el body de estas dos rutas como `{ file: string }`
 * (openapi-typescript representa `format: binary` como `string` — es
 * correcto para documentación, no para el tipo real en tiempo de
 * ejecución). El propio openapi-fetch SÍ soporta pasar un `FormData` real
 * como body — su bodySerializer por defecto detecta `body instanceof
 * FormData` y lo manda tal cual, dejando que el navegador fije
 * Content-Type/boundary solo (nunca a mano) — pero el tipo generado no
 * modela eso. `as never` es el escape hatch mínimo para este desajuste
 * puntual, no una forma de saltarse la validación real (esa sigue
 * viviendo enteramente en el backend).
 */
function formDataConArchivo(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

function aFotoSubida(data: { id?: string; url?: string } | undefined): UploadedPhoto | null {
  if (!data?.id || !data.url) return null;
  return { id: data.id, url: data.url };
}

export async function uploadBusinessPhoto(businessId: string, file: File): Promise<PhotoMutationResult> {
  const { data, response } = await api.POST("/businesses/{businessId}/photos", {
    params: { path: { businessId } },
    body: formDataConArchivo(file) as never,
  });
  const photo = aFotoSubida(data);
  return { ok: response.ok && photo !== null, photo, status: response.status };
}

export async function uploadProductPhoto(productId: string, file: File): Promise<PhotoMutationResult> {
  const { data, response } = await api.POST("/products/{productId}/photos", {
    params: { path: { productId } },
    body: formDataConArchivo(file) as never,
  });
  const photo = aFotoSubida(data);
  return { ok: response.ok && photo !== null, photo, status: response.status };
}

export async function deletePhoto(photoId: string): Promise<{ ok: boolean; status: number | undefined }> {
  const { response } = await api.DELETE("/photos/{photoId}", {
    params: { path: { photoId } },
  });
  return { ok: response.ok, status: response.status };
}

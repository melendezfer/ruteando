import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import { getAdminAccessToken } from "@/lib/admin/admin-token-store";

/**
 * Cliente HTTP DEDICADO del panel de administrador (Fase 1, sin RF
 * asociado — ver CLAUDE.md) — instancia separada de `lib/api/client.ts`
 * (el del resto de la app), a propósito: comparten el mismo `paths`
 * generado (un solo backend, un solo contrato), pero cada cliente
 * adjunta el token de SU PROPIO almacenamiento — así es estructuralmente
 * imposible que una llamada del panel de administrador termine
 * mandando, por error, el Authorization de una sesión de vendedor/
 * consumidor, o viceversa.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const adminApi = createClient<paths>({ baseUrl });

const adminAuthMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAdminAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
};

adminApi.use(adminAuthMiddleware);

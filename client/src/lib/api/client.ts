import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { getAccessToken } from "@/lib/auth/token-store";

/**
 * Cliente HTTP tipado a partir de openapi.yaml (Épica F0). Tipos generados
 * por `npm run generate:api` (openapi-typescript) — nunca se escriben a
 * mano, y `schema.ts` no se comitea (ver .gitignore): se regenera solo,
 * antes de `dev`/`build` (scripts predev/prebuild en package.json), así
 * nunca queda desactualizado respecto al contrato real del backend.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const api = createClient<paths>({ baseUrl });

/**
 * Adjunta el access token vigente (en memoria, ver token-store.ts) a
 * cada request — así ni auth-context.tsx ni las pantallas tienen que
 * acordarse de mandarlo a mano. Sin reintento automático en 401 todavía
 * (eso implicaría lógica de refresco dentro del propio cliente HTTP,
 * acoplada al contexto de auth) — auth-context.tsx ya cubre el único
 * caso que le corresponde a la Épica F1 (refresco silencioso al montar
 * la app), no cada request individual.
 */
const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
};

api.use(authMiddleware);

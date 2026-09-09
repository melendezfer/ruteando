import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Cliente HTTP tipado a partir de openapi.yaml (Épica F0). Tipos generados
 * por `npm run generate:api` (openapi-typescript) — nunca se escriben a
 * mano, y `schema.ts` no se comitea (ver .gitignore): se regenera solo,
 * antes de `dev`/`build` (scripts predev/prebuild en package.json), así
 * nunca queda desactualizado respecto al contrato real del backend.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const api = createClient<paths>({ baseUrl });

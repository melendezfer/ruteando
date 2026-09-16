import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type AuthTokens = components["schemas"]["AuthTokens"];

interface ChangePasswordResult {
  ok: boolean;
  status: number | undefined;
  tokens: AuthTokens | null;
}

/**
 * POST /users/me/change-password (sin RF asociado — ver CLAUDE.md
 * sección 39/40). Distinto de password-reset.ts: acá la sesión ya
 * existe, la prueba de identidad es la contraseña actual, no un token
 * de correo.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const { data, response } = await api.POST("/users/me/change-password", {
    body: { currentPassword, newPassword },
  });
  return { ok: response.ok, status: response.status, tokens: data ?? null };
}

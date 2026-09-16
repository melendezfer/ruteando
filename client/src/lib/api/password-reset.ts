import { api } from "@/lib/api/client";

interface RequestResult {
  ok: boolean;
  status: number | undefined;
}

/**
 * RF-003 (recuperación de contraseña) — el backend ya estaba completo
 * desde la Épica 1, sin ningún consumidor en el frontend hasta ahora.
 * Sin proveedor de correo elegido todavía (ver CLAUDE.md), el enlace se
 * registra en el log estructurado del backend en vez de enviarse — en
 * desarrollo, hay que revisarlo ahí para completar el flujo.
 *
 * Misma respuesta (202) exista o no la cuenta — RF-003, no permite
 * enumerar usuarios. Por eso este helper nunca distingue "correo no
 * encontrado" de "listo, revisa tu correo": la pantalla que lo llama
 * muestra el mismo mensaje de éxito siempre que la petición responda
 * 202, sin importar el resultado real.
 */
export async function requestPasswordReset(email: string): Promise<RequestResult> {
  const { response } = await api.POST("/auth/forgot-password", { body: { email } });
  return { ok: response.ok, status: response.status };
}

/** POST /auth/reset-password — completa la recuperación con el token del enlace. */
export async function resetPassword(token: string, newPassword: string): Promise<RequestResult> {
  const { response } = await api.POST("/auth/reset-password", {
    body: { token, newPassword },
  });
  return { ok: response.ok, status: response.status };
}

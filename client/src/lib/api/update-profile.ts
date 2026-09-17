import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type User = components["schemas"]["User"];

interface UpdateProfileResult {
  ok: boolean;
  status: number | undefined;
  user: User | null;
}

/**
 * PATCH /users/me (sin RF asociado — ver CLAUDE.md): solo fullName/phone,
 * deliberadamente sin profilePhotoUrl (sin pipeline de subida de foto de
 * perfil de usuario todavía).
 */
export async function updateProfile(input: {
  fullName?: string;
  phone?: string;
}): Promise<UpdateProfileResult> {
  const { data, response } = await api.PATCH("/users/me", { body: input });
  return { ok: response.ok, status: response.status, user: data ?? null };
}

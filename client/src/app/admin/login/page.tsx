"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { useAdminAuth } from "@/lib/admin/admin-auth-context";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

/**
 * Login del panel de administrador (Fase 1, sin RF asociado — ver
 * CLAUDE.md) — deliberadamente SEPARADO del login de vendedor/
 * consumidor ((auth)/login/page.tsx): sin "¿Olvidaste tu contraseña?"
 * ni link a registro (no hay autorregistro de administradores — ver
 * scripts/crearAdministradorMaestro.js), sin modal de consentimiento
 * (Ley 1581 no le aplica a esta cuenta).
 */
export default function AdminLoginPage() {
  const { login, status } = useAdminAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await login(email, password);

    setSubmitting(false);
    if (result.ok) {
      router.push("/admin/dashboard");
      return;
    }
    setError(result.message ?? "No pudimos iniciar la sesión.");
  }

  if (status === "authenticated") {
    router.replace("/admin/dashboard");
    return null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck size={40} weight="duotone" className="text-terracota" />
          <h1 className="font-heading text-title-1 font-bold text-text">Panel de administrador</h1>
          <p className="font-sans text-body-sm text-text-muted">Acceso exclusivo para el equipo de Ruteando.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

          <Button type="submit" loading={submitting}>
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}

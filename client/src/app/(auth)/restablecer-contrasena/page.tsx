"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api/password-reset";
import { getResetPasswordErrorMessage } from "@/lib/api/error-messages";

/**
 * RF-003 — completa la recuperación con el `token` que llega en el
 * enlace del correo (`?token=...`), ej.
 * /restablecer-contrasena?token=abc123 — mismo nombre de parámetro que
 * usa POST /auth/reset-password. `useSearchParams()` exige un límite
 * `Suspense` (Next.js) — el componente real vive en `RestablecerForm`,
 * separado solo por eso.
 */
export default function RestablecerContrasenaPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  );
}

function RestablecerForm() {
  const token = useSearchParams().get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-title-1 font-bold text-text">Enlace incompleto</h1>
        <p className="font-sans text-body text-text-muted">
          Este enlace no incluye el código necesario para restablecer tu contraseña — ábrelo tal
          cual llegó en el correo, o pide uno nuevo.
        </p>
        <Link href="/recuperar-contrasena" className="font-sans text-body text-terracota underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-title-1 font-bold text-text">Contraseña actualizada</h1>
        <p className="font-sans text-body text-text-muted">
          Ya puedes iniciar sesión con tu contraseña nueva — por seguridad, cerramos todas las
          sesiones que tenías abiertas.
        </p>
        <Link href="/login" className="font-sans text-body text-terracota underline">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await resetPassword(token!, newPassword);

    setSubmitting(false);

    if (!result.ok) {
      setError(getResetPasswordErrorMessage(result.status));
      return;
    }

    setDone(true);
  }

  return (
    <>
      <h1 className="font-heading text-title-1 font-bold text-text">Elige una contraseña nueva</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <TextField
          label="Repite la contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <Button type="submit" loading={submitting}>
          Guardar contraseña
        </Button>
      </form>
    </>
  );
}

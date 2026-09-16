"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/api/password-reset";
import { getForgotPasswordErrorMessage } from "@/lib/api/error-messages";

/**
 * RF-003 — POST /auth/forgot-password ya existía completo desde la
 * Épica 1, sin ningún consumidor en el frontend hasta ahora (ver
 * CLAUDE.md). Misma respuesta exista o no la cuenta, por diseño (no
 * permite enumerar usuarios) — por eso el mensaje de éxito es siempre
 * el mismo, nunca "no encontramos esa cuenta".
 */
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await requestPasswordReset(email);

    setSubmitting(false);

    if (!result.ok) {
      setError(getForgotPasswordErrorMessage(result.status));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-title-1 font-bold text-text">Revisa tu correo</h1>
        <p className="font-sans text-body text-text-muted">
          Si <strong>{email}</strong> tiene una cuenta en Ruteando, te enviamos un enlace para
          restablecer tu contraseña. El enlace vence en poco tiempo.
        </p>
        <Link href="/login" className="font-sans text-body text-terracota underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading text-title-1 font-bold text-text">¿Olvidaste tu contraseña?</h1>
      <p className="font-sans text-body-sm text-text-muted">
        Escribe tu correo y te enviamos un enlace para restablecerla.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <Button type="submit" loading={submitting}>
          Enviar enlace
        </Button>
      </form>

      <p className="text-center font-sans text-body-sm text-text-muted">
        <Link href="/login" className="font-medium text-terracota underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}

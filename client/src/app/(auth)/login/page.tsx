"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { ConsentRequiredModal } from "@/components/auth/consent-required-modal";
import { MANDATORY_CONSENT_TEXT_VERSION, type MandatoryConsentType } from "@/lib/api/consents";

/**
 * Épica F1. Solo "Entrar con correo" — sin passkeys (CLAUDE.md sección
 * 14) todavía: esa opción requiere rutas nuevas en el backend
 * (POST /auth/webauthn/register, POST /auth/webauthn/login) que no
 * existen hoy. Queda pendiente de decidir en qué épica se aborda.
 */
export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // RF-018, bug real (ver ConsentRequiredModal): un login que devuelve
  // 403 consent-required no es un error de formulario más — abre este
  // modal en vez de un mensaje de texto sin ninguna acción posible.
  const [missingConsentTypes, setMissingConsentTypes] = useState<MandatoryConsentType[] | null>(null);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await login(email, password);

    if (result.ok) {
      router.push("/");
      return;
    }

    setSubmitting(false);

    if (result.missingConsentTypes && result.missingConsentTypes.length > 0) {
      setMissingConsentTypes(result.missingConsentTypes);
      return;
    }

    setFormError(result.message ?? null);
    setFieldErrors(result.fieldErrors ?? {});
  }

  async function handleConsentConfirm() {
    if (!missingConsentTypes) return;
    setConsentSubmitting(true);
    setConsentError(null);

    const result = await login(
      email,
      password,
      missingConsentTypes.map((type) => ({ type, textVersion: MANDATORY_CONSENT_TEXT_VERSION })),
    );

    if (result.ok) {
      router.push("/");
      return;
    }

    setConsentSubmitting(false);
    setConsentError(result.message ?? "No pudimos guardar el consentimiento. Intenta de nuevo.");
  }

  if (status === "authenticated") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-sans text-body text-text">Ya iniciaste sesión.</p>
        <Link href="/" className="font-sans text-body text-terracota underline">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading text-title-1 font-bold text-text">Iniciar sesión</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        {formError && <p className="font-sans text-body-sm text-rojo">{formError}</p>}

        <Button type="submit" loading={submitting}>
          Entrar
        </Button>
      </form>

      <p className="text-center font-sans text-body-sm text-text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-terracota underline">
          Regístrate
        </Link>
      </p>

      {missingConsentTypes && (
        <ConsentRequiredModal
          missingTypes={missingConsentTypes}
          submitting={consentSubmitting}
          error={consentError}
          onConfirm={handleConsentConfirm}
          onCancel={() => {
            setMissingConsentTypes(null);
            setConsentError(null);
          }}
        />
      )}
    </>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

type Role = "consumer" | "vendor";

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("consumer");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await register({ fullName, email, password, role });

    if (result.ok) {
      router.push("/");
      return;
    }

    setSubmitting(false);
    setFormError(result.message ?? null);
    setFieldErrors(result.fieldErrors ?? {});
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
      <h1 className="font-heading text-title-1 font-bold text-text">Crear cuenta</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Nombre completo"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.fullName}
        />
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="font-sans text-body-sm font-medium text-text">
            ¿Cómo vas a usar Ruteando?
          </legend>
          <label className="flex items-center gap-2 font-sans text-body text-text">
            <input
              type="radio"
              name="role"
              value="consumer"
              checked={role === "consumer"}
              onChange={() => setRole("consumer")}
            />
            Busco negocios (consumidor)
          </label>
          <label className="flex items-center gap-2 font-sans text-body text-text">
            <input
              type="radio"
              name="role"
              value="vendor"
              checked={role === "vendor"}
              onChange={() => setRole("vendor")}
            />
            Vendo comida (vendedor)
          </label>
        </fieldset>

        {formError && <p className="font-sans text-body-sm text-rojo">{formError}</p>}

        <Button type="submit" loading={submitting}>
          Crear cuenta
        </Button>
      </form>

      <p className="text-center font-sans text-body-sm text-text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-terracota underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}

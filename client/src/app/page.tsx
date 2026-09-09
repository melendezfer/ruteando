"use client";

import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Placeholder de la Épica F0/F1 — no es la pantalla de inicio real (esa
 * llega en F2). Sirve para probar que los tokens de diseño y, ahora, el
 * estado de sesión (AuthProvider) quedan bien cableados antes de
 * construir la pantalla de verdad encima.
 */
export default function Home() {
  const { status, user, logout } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <CookingPot size={48} weight="duotone" className="text-terracota" />
      <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>

      {status === "loading" && (
        <p className="font-sans text-body text-text-muted">Cargando sesión…</p>
      )}

      {status === "unauthenticated" && (
        <>
          <p className="max-w-sm font-sans text-body text-text-muted">
            Base de las Épicas F0/F1: tokens de diseño, PWA, autenticación. Las pantallas reales
            empiezan en la Épica F2.
          </p>
          <div className="flex gap-3">
            <Link href="/login">
              <Button type="button">Iniciar sesión</Button>
            </Link>
            <Link href="/register">
              <Button type="button" variant="secondary">
                Crear cuenta
              </Button>
            </Link>
          </div>
        </>
      )}

      {status === "authenticated" && user && (
        <>
          <p className="max-w-sm font-sans text-body text-text-muted">
            Sesión iniciada como <span className="font-medium text-text">{user.fullName}</span> (
            {user.email})
          </p>
          <Button type="button" variant="secondary" onClick={() => logout()}>
            Cerrar sesión
          </Button>
        </>
      )}
    </main>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Guarda de sesión compartida entre pantallas autenticadas (Inicio de la
 * Épica F2, Mapa de la Épica F3, y las que sigan) — antes de la Épica F3
 * esta lógica de loading/no-autenticado vivía duplicada solo en
 * src/app/page.tsx; con una segunda pantalla que la necesita, se extrae
 * acá en vez de copiarla de nuevo.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <CookingPot size={48} weight="duotone" className="text-terracota" />
        <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>
        <p className="font-sans text-body text-text-muted">Cargando sesión…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <CookingPot size={48} weight="duotone" className="text-terracota" />
        <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>
        <p className="max-w-sm font-sans text-body text-text-muted">
          Encuentra comida callejera cerca de ti y contacta al vendedor directo por WhatsApp.
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
      </main>
    );
  }

  return <>{children}</>;
}

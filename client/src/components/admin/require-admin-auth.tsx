"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/admin-auth-context";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";

/**
 * Guarda de sesión del panel de administrador — mismo criterio que
 * RequireAuth (components/auth/require-auth.tsx), pero redirige a
 * /admin/login en vez de mostrar botones de login/registro inline (esta
 * no es una pantalla pública con acciones alternativas, es un panel
 * interno: sin sesión, no hay nada que mostrar acá).
 */
export function RequireAdminAuth({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <RuteandoLogo size={40} />
        <p className="font-sans text-body text-text-muted">Cargando sesión…</p>
      </main>
    );
  }

  return <>{children}</>;
}

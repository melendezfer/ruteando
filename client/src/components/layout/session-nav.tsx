"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";

/**
 * La columna de navegación solo con sesión (pantallas que también se abren
 * sin cuenta: perfil de un negocio, textos legales). Regla del usuario
 * (2026-10-03): con sesión, volver al mapa está siempre a un toque.
 */
export function SessionNav() {
  const { user } = useAuth();
  return user ? <MainFloatingNav /> : null;
}

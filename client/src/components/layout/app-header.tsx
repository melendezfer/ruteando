"use client";

import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Encabezado compartido entre pantallas autenticadas — solo branding y
 * acciones secundarias (registrar negocio, cerrar sesión). Ya NO lleva
 * navegación Inicio/Mapa/Perfil: eso es responsabilidad exclusiva de
 * `BottomNavBar` (CLAUDE.md sección 27) desde que esa barra se construyó
 * — mantener los dos con enlaces de navegación habría sido dos patrones
 * compitiendo por la misma pregunta ("dónde estoy/a dónde voy"). Por eso
 * ya no recibe `activeTab`: no hay nada acá que dependa de la ruta
 * actual.
 */
export function AppHeader() {
  const { logout, user } = useAuth();

  // Único punto de entrada al asistente de registro de negocio (Épica
  // F5) — solo se ofrece a roles que de verdad pueden completarlo
  // (businesses.routes.js/auth.routes.js exigen 'vendor' o
  // 'administrator' respectivamente); un consumidor no tiene forma de
  // usarlo todavía, así que no vale la pena mostrarle un enlace muerto.
  const canRegisterBusiness = user?.role === "vendor" || user?.role === "administrator";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
      <span className="flex items-center gap-2 font-heading text-title-2 font-bold text-text">
        <CookingPot size={24} weight="duotone" className="text-terracota" />
        Ruteando
      </span>
      <div className="flex items-center gap-4">
        {canRegisterBusiness && (
          <Link
            href="/negocios/nuevo"
            className="font-sans text-body-sm font-medium text-text-muted hover:text-text"
          >
            {user?.role === "administrator" ? "Registro asistido" : "Registrar negocio"}
          </Link>
        )}
        <Button type="button" variant="secondary" onClick={() => logout()}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}

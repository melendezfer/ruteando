"use client";

import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  activeTab: "inicio" | "mapa" | "perfil";
}

/**
 * Encabezado compartido entre pantallas autenticadas. La navegación de
 * cuatro destinos que fija el Documento 08 (sección 5.3.1) todavía no
 * está construida como tal (no la pidió ninguna épica hasta ahora) — este
 * header es el mínimo necesario para que Inicio (F2) y Mapa (F3) sean
 * alcanzables entre sí sin duplicar el logout en cada pantalla.
 */
export function AppHeader({ activeTab }: AppHeaderProps) {
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
      <nav className="flex items-center gap-4">
        <Link
          href="/"
          className={`font-sans text-body-sm font-medium ${
            activeTab === "inicio" ? "text-terracota" : "text-text-muted hover:text-text"
          }`}
        >
          Inicio
        </Link>
        <Link
          href="/mapa"
          className={`font-sans text-body-sm font-medium ${
            activeTab === "mapa" ? "text-terracota" : "text-text-muted hover:text-text"
          }`}
        >
          Mapa
        </Link>
        {canRegisterBusiness && (
          <Link
            href="/negocios/nuevo"
            className="font-sans text-body-sm font-medium text-text-muted hover:text-text"
          >
            {user?.role === "administrator" ? "Registro asistido" : "Registrar negocio"}
          </Link>
        )}
        <Link
          href="/perfil"
          className={`font-sans text-body-sm font-medium ${
            activeTab === "perfil" ? "text-terracota" : "text-text-muted hover:text-text"
          }`}
        >
          Perfil
        </Link>
      </nav>
      <Button type="button" variant="secondary" onClick={() => logout()}>
        Cerrar sesión
      </Button>
    </header>
  );
}

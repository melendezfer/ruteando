"use client";

import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";

/**
 * Encabezado compartido entre pantallas autenticadas — solo branding y
 * acciones secundarias (registrar negocio, cerrar sesión). Ya NO lleva
 * navegación Inicio/Mapa/Perfil: eso es responsabilidad exclusiva de
 * `BottomNavBar` (CLAUDE.md sección 27) desde que esa barra se construyó
 * — mantener los dos con enlaces de navegación habría sido dos patrones
 * compitiendo por la misma pregunta ("dónde estoy/a dónde voy"). Por eso
 * ya no recibe `activeTab`: no hay nada acá que dependa de la ruta
 * actual.
 *
 * Petición directa del usuario, sin RF asociado: el nombre del usuario
 * (`user?.fullName`, ya disponible en el contexto de auth — sin pedir
 * nada nuevo al backend) no se mostraba en ningún lado del header. Se
 * agrega junto a la acción de cerrar sesión — y, para hacerle espacio,
 * "Cerrar sesión" pasa de botón de texto a un ícono solo (`SignOut`),
 * con `aria-label` porque un ícono solo no es autoexplicativo.
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
        <RuteandoLogo size={28} />
        Ruteando
      </span>
      <div className="flex min-w-0 items-center gap-4">
        {canRegisterBusiness && (
          <Link
            href="/negocios/nuevo"
            className="font-sans text-body-sm font-medium text-text-muted hover:text-text"
          >
            {user?.role === "administrator" ? "Registro asistido" : "Registrar negocio"}
          </Link>
        )}
        {user?.fullName && (
          <span className="max-w-[9rem] truncate font-sans text-body-sm font-medium text-text" title={user.fullName}>
            {user.fullName}
          </span>
        )}
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-background hover:text-text"
        >
          <SignOut size={20} weight="bold" />
        </button>
      </div>
    </header>
  );
}

import Link from "next/link";
import { Storefront } from "@phosphor-icons/react/dist/ssr";

/**
 * "Registra tu negocio" para un vendedor que todavía no tiene ninguno
 * (pedido del usuario, 2026-09-29): el único acceso al asistente vivía en
 * AppHeader, que desapareció con la navegación flotante (CLAUDE.md §53), y
 * un vendedor nuevo quedaba en el mapa sin ninguna forma de registrarlo.
 */
export function RegisterBusinessCard() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-terracota-100 bg-terracota-50 p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-terracota">
        <Storefront size={26} weight="bold" />
      </span>
      <h2 className="font-heading text-title-1 font-bold text-text">Registra tu negocio</h2>
      <p className="font-sans text-body text-text-muted">
        En menos de 10 minutos: nombre, dónde vendes y tu horario. Así tus clientes te encuentran en el mapa.
      </p>
      <Link
        href="/negocios/nuevo"
        className="flex h-btn items-center justify-center rounded-input bg-terracota px-6 font-sans text-button font-semibold text-white hover:bg-terracota-dark"
      >
        Registrar mi negocio
      </Link>
    </section>
  );
}

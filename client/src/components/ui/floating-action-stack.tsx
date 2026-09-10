import { NavigationArrow, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

interface FloatingActionStackProps {
  /** null cuando el negocio no tiene teléfono de contacto — oculta el botón en vez de enlazar a nada. */
  whatsappHref: string | null;
  /** null cuando el negocio no tiene ubicación registrada todavía. */
  directionsHref: string | null;
  onWhatsAppClick?: () => void;
}

/**
 * Reemplaza los dos botones horizontales que describía originalmente el
 * Documento 08 para el perfil de negocio: acá WhatsApp es la acción
 * principal (círculo grande, terracota) y "Cómo llegar" la secundaria
 * (círculo más chico), apiladas como un stack flotante — no existía
 * ningún componente con este nombre en el código antes de esta épica; se
 * construye acá siguiendo exactamente la composición que pidió el
 * usuario para reemplazar el layout original.
 *
 * Ambos enlaces abren fuera de la app (`wa.me` y Google Maps) — "Cómo
 * llegar" no reimplementa navegación (CLAUDE.md Épica 5).
 */
export function FloatingActionStack({ whatsappHref, directionsHref, onWhatsAppClick }: FloatingActionStackProps) {
  if (!whatsappHref && !directionsHref) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
      {directionsHref && (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cómo llegar"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg transition-transform hover:scale-105"
        >
          <NavigationArrow size={22} weight="fill" />
        </a>
      )}
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWhatsAppClick}
          aria-label="Contactar por WhatsApp"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-terracota text-white shadow-xl transition-transform hover:scale-105"
        >
          <WhatsappLogo size={32} weight="fill" />
        </a>
      )}
    </div>
  );
}

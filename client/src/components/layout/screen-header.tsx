import { BackButton } from "@/components/ui/back-button";

interface ScreenHeaderProps {
  title: string;
  /** A dónde lleva "Volver" si no hay pantalla anterior en esta sesión. */
  fallbackHref?: string;
}

/**
 * Encabezado de pantalla (Etapa 1b, pedido del usuario 2026-10-03): solo
 * "Volver" y el título. Sin íconos de acción arriba — las acciones de
 * navegación viven en la columna del costado derecho (MainFloatingNav) y
 * las de la pantalla, dentro de su contenido.
 */
export function ScreenHeader({ title, fallbackHref = "/mapa" }: ScreenHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2">
      <BackButton fallbackHref={fallbackHref} className="shadow-none" />
      <h1 className="min-w-0 truncate font-heading text-title-2 font-bold text-text">{title}</h1>
    </header>
  );
}

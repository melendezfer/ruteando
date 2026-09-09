import { CookingPot } from "@phosphor-icons/react/dist/ssr";

/**
 * Placeholder de la Épica F0 — no es una pantalla real (esa llega en F2).
 * Solo demuestra que los tokens de diseño (colores, escala tipográfica),
 * las tipografías y Phosphor Icons quedan bien cableados antes de
 * construir nada encima.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <CookingPot size={48} weight="duotone" className="text-terracota" />

      <span className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">
        Épica F0
      </span>

      <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>

      <p className="max-w-sm font-sans text-body text-text-muted">
        Base de la Épica F0 lista: tokens de diseño, PWA, tipografías y cliente de API tipado. Las
        pantallas reales empiezan en la Épica F1.
      </p>

      <span className="rounded-full bg-ambar/20 px-3 py-1 font-sans text-caption font-medium uppercase tracking-wide text-ambar">
        Pendiente
      </span>

      <button
        type="button"
        className="h-btn rounded-input bg-terracota px-6 font-sans text-button font-semibold text-white transition-colors hover:bg-terracota-dark"
      >
        Botón de ejemplo (48px)
      </button>
    </main>
  );
}

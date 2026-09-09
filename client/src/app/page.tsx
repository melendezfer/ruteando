import { CookingPot } from "@phosphor-icons/react/dist/ssr";

/**
 * Placeholder de la Épica F0 — no es una pantalla real (esa llega en F2).
 * Solo demuestra que los tokens de diseño, las tipografías y Phosphor
 * Icons quedan bien cableados antes de construir nada encima.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <CookingPot size={48} weight="duotone" className="text-terracota" />
      <h1 className="font-heading text-3xl font-semibold text-text">Ruteando</h1>
      <p className="max-w-sm text-text-muted">
        Base de la Épica F0 lista: tokens de diseño, PWA, tipografías y cliente de API tipado.
        Las pantallas reales empiezan en la Épica F1.
      </p>
      <button
        type="button"
        className="h-btn rounded-input bg-terracota px-6 font-medium text-white transition-colors hover:bg-terracota-dark"
      >
        Botón de ejemplo (48px)
      </button>
    </main>
  );
}

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo tiene dos package-lock.json (raíz para el backend, client/
  // para este proyecto) — sin esto, Turbopack infiere mal la raíz del
  // workspace (toma la del repo, no la de client/) y lo advierte en cada
  // arranque de `next dev`.
  turbopack: {
    root: path.join(__dirname),
  },
  // Redediseño de navegación global (sin RF asociado, petición directa
  // del usuario — ver CLAUDE.md sección 53): el indicador de Next.js Dev
  // Tools (`next dev`, invisible en producción) ocupa por defecto la
  // esquina inferior izquierda — la misma donde vive ahora el logo fijo
  // de marca de la pantalla de mapa. Investigado en vivo con Playwright
  // antes de tocar esto: en su posición default el logo SÍ se veía bien
  // (una confusión visual propia al revisar una captura muy chica — una
  // "R" mayúscula en un pin violeta, a 32px, se lee parecida a un
  // círculo con "N"), pero **reposicionar el indicador sí causaba
  // choques reales**, confirmados con `<nextjs-portal>` interceptando el
  // clic de verdad: "bottom-right" tapaba `MainFloatingNav`; "top-right"
  // tapaba el ícono "Cambiar de familia" del banner; "top-left" tapaba
  // "Volver" de `FilteredListSheet`. Se apaga del todo en vez de perseguir
  // una quinta esquina — la app ya usa las 4 para algo fijo en algún
  // estado de esta pantalla. Sin impacto en producción (`next build`/
  // `next start`): este indicador nunca existió ahí.
  devIndicators: false,
};

export default nextConfig;

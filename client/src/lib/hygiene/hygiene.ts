/**
 * Sello de higiene autodeclarada (petición directa del usuario, sin RF
 * asociado — ver CLAUDE.md). Único lugar del frontend con los textos
 * exactos del sello y de la guía de buenas prácticas — mismo criterio
 * que review-tags.ts con el catálogo de etiquetas de reseñas: un solo
 * lugar evita que el texto del toggle (dueño, hygiene-badge-toggle.tsx)
 * y el de la insignia pública (cualquiera, hygiene-badge.tsx) diverjan
 * con el tiempo.
 *
 * CUIDADO LEGAL: el sello es una AUTOdeclaración voluntaria del
 * vendedor. Ningún texto de este archivo usa lenguaje que sugiera una
 * certificación oficial, una inspección o una verificación de
 * cumplimiento por parte de RUTEANDO — la aclaración va explícita tanto
 * en el modal público (HygieneBadge, visible para cualquiera que vea el
 * perfil) como en la pantalla donde el dueño activa el sello
 * (HygieneBadgeToggle), no solo en uno de los dos lugares.
 */

export const HYGIENE_BADGE_LABEL = "Higiene autodeclarada";

export const HYGIENE_DISCLAIMER_TITLE = "Sello de higiene autodeclarada";

// El primer párrafo describe QUÉ declaró el vendedor; el segundo es la
// aclaración legal en sí — ambos se muestran siempre juntos, nunca uno
// sin el otro.
export const HYGIENE_DISCLAIMER_BODY = [
  "Este vendedor declaró, por su propia cuenta, que sigue un conjunto de buenas prácticas de higiene en la preparación y manejo de sus alimentos (por ejemplo: lavar y preparar en casa, mantener la comida tapada, manejo seguro del cilindro de gas).",
  "Esta declaración es voluntaria y no ha sido verificada por RUTEANDO. No es una certificación oficial de sanidad ni una garantía de cumplimiento de normas sanitarias — RUTEANDO es un intermediario de información, no un ente certificador.",
];

export interface HygieneGuideStep {
  title: string;
  description: string;
}

// Guía de referencia (contenido educativo, sin diseño elaborado a
// propósito — texto simple, ver CLAUDE.md). Los 5 títulos son los que
// pidió el usuario, textual; la descripción de cada uno es la única
// parte redactada acá.
export const HYGIENE_GUIDE_STEPS: HygieneGuideStep[] = [
  {
    title: "Lava y prepara en casa",
    description: "Lávate bien las manos y lava los utensilios antes de preparar tus alimentos.",
  },
  {
    title: "Tapa siempre tu comida",
    description: "Protégela del polvo, los insectos y el sol mientras la vendes.",
  },
  {
    title: "Cuídate para cuidar al cliente",
    description:
      "Si estás enfermo o tienes heridas en las manos, evita manipular alimentos ese día.",
  },
  {
    title: "El cilindro de gas lejos del paso",
    description: "Ubica y revisa tu cilindro en un lugar seguro, lejos del tránsito de gente.",
  },
  {
    title: "Usa tu celular a tu favor",
    description: "Avisa a tus clientes por WhatsApp si cambias de horario o de ubicación.",
  },
];

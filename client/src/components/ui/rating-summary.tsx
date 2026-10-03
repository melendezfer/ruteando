import { Star } from "@phosphor-icons/react/dist/ssr";

/** "4,7" con coma decimal (es-CO). */
export function formatRating(value: number): string {
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/**
 * Calificación pública (regla del usuario 2026-10-03, docs/specs/perfil-2.md
 * §3.6): "★ 4,7 · 12 calificaciones", la misma en el perfil, la hoja del
 * mapa y el carrusel. Sin calificaciones: "Sin calificaciones todavía".
 */
export function RatingSummary({
  averageRating,
  reviewCount,
  className = "",
}: {
  averageRating: number | null | undefined;
  reviewCount: number | null | undefined;
  className?: string;
}) {
  const total = reviewCount ?? 0;
  if (averageRating == null || total === 0) {
    return <span className={`font-sans text-body-sm text-text-muted ${className}`}>Sin calificaciones todavía</span>;
  }
  return (
    <span
      data-rating-summary
      aria-label={`${formatRating(averageRating)} de 5 estrellas, ${total} ${total === 1 ? "calificación" : "calificaciones"}`}
      className={`inline-flex items-center gap-1 font-sans text-body-sm text-text ${className}`}
    >
      <Star size={14} weight="fill" className="text-estrella" aria-hidden="true" />
      <span className="font-semibold">{formatRating(averageRating)}</span>
      <span className="text-text-muted">
        · {total} {total === 1 ? "calificación" : "calificaciones"}
      </span>
    </span>
  );
}

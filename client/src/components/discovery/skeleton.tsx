/**
 * Skeleton screen genérico (Documento 08, sección 5.5.7 / tabla 11) — un
 * bloque que pulsa en el color de borde/superficie mientras carga, en vez
 * de un spinner genérico. `Documento 08` no está en este repositorio (solo
 * sus referencias en CLAUDE.md), así que la forma exacta de cada skeleton
 * (alto, ancho) la fija cada pantalla que lo usa, no este componente.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-border/60 ${className}`} />;
}

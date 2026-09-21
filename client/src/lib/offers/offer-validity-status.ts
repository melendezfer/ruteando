/**
 * Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
 * ver CLAUDE.md, migración productos-tipo-oferta. Texto corto para el
 * badge de `ProductRow` — `now` es un parámetro (no `new Date()` adentro)
 * por el mismo motivo que `offer-validity.ts`: reproducibilidad, no
 * porque en producción sea otra cosa que "ahora mismo".
 */
export function describeOfferValidUntil(
  validUntil: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!validUntil) return "Vigente hasta nuevo aviso";
  const until = new Date(validUntil);
  if (until.getTime() <= now.getTime()) return "Oferta vencida";
  return `Vigente hasta ${until.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`;
}

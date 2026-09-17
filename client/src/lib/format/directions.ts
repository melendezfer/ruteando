/**
 * "Cómo llegar" (Documento 08 §5.4.3, CLAUDE.md sección 20) — enlace
 * externo a Google Maps con las coordenadas del negocio, nunca
 * reimplementar navegación dentro de la app. Extraído de
 * business-profile-screen.tsx (Fase A de la retroalimentación sobre el
 * buscador, sin RF asociado — ver CLAUDE.md sección 45/51) para
 * reusarse también en los resultados de búsqueda (BusinessCard,
 * MapSearchResults) — mismo formato de URL en los tres lugares, un solo
 * sitio si alguna vez cambia.
 */
export function buildDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

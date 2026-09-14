/**
 * `GET /businesses/{businessId}` devuelve `photos` ordenado ASCENDENTE
 * por `displayOrder` (ver fotos.repository.js#listarPorNegocio,
 * `ORDER BY orden_visualizacion`) — así que la PRIMERA coincidencia de
 * un `.find()` es la foto MÁS ANTIGUA, no la más reciente. Antes de la
 * carga de fotos desde el frontend eso no importaba (el seed de demo
 * nunca sembró más de una foto por negocio/producto); ahora que un
 * vendedor puede subir una foto nueva sin que el borrado de la anterior
 * esté garantizado (best-effort, ver photo-upload-control.tsx), mostrar
 * la más RECIENTE es lo que hace que "reemplazar" se vea de verdad como
 * un reemplazo incluso si ese borrado llegó a fallar.
 */
export function pickLatestPhoto<T extends { displayOrder?: number | null }>(
  photos: T[] | undefined,
  predicate: (photo: T) => boolean,
): T | null {
  const candidatos = (photos ?? []).filter(predicate);
  if (candidatos.length === 0) return null;

  return candidatos.reduce((masReciente, actual) =>
    (actual.displayOrder ?? 0) > (masReciente.displayOrder ?? 0) ? actual : masReciente,
  );
}

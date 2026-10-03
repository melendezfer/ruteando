/**
 * Promedio y número de calificaciones públicas de un negocio (las
 * 'aprobada': desde 2026-10-03 toda calificación nace así y solo sale si la
 * reportan). Para los LISTADOS (mapa, carrusel, búsqueda, favoritos): el
 * perfil usa resenas.repository.js#obtenerAgregado con la misma regla.
 * Usa idx_resenas_negocio. Columnas: resenas_promedio, resenas_total.
 */
function lateralCalificaciones(negocioAlias = 'n') {
  return `LEFT JOIN LATERAL (
       SELECT round(avg(r.calificacion)::numeric, 1) AS resenas_promedio, count(*)::int AS resenas_total
       FROM resenas r
       WHERE r.negocio_id = ${negocioAlias}.id AND r.estado_moderacion = 'aprobada'
     ) cal ON true`;
}

module.exports = { lateralCalificaciones };

const pool = require('../config/db');

/**
 * Calificación promedio y conteo de reseñas APROBADAS de un negocio, para
 * el perfil público (RF-012). Filtra por estado_moderacion='aprobada' —
 * mismo criterio que usará GET /businesses/{businessId}/reviews cuando
 * exista (Épica 6) — para que una reseña recién creada (estado
 * 'pendiente' por defecto) o rechazada no infle el promedio antes de que
 * un administrador la revise (Épica 9).
 *
 * Hoy (antes de la Épica 6, que agrega la única forma de crear una
 * reseña) esto siempre da { promedio: null, total: 0 } porque la tabla
 * está vacía — es el resultado correcto de una agregación real contra
 * una tabla sin filas, no un valor fijo — ver CLAUDE.md sección 10.
 */
async function obtenerAgregado(negocioId) {
  const { rows } = await pool.query(
    `SELECT AVG(calificacion)::float AS promedio, count(*)::int AS total
     FROM resenas
     WHERE negocio_id = $1 AND estado_moderacion = 'aprobada'`,
    [negocioId],
  );
  return rows[0];
}

module.exports = { obtenerAgregado };

const pool = require('../config/db');

async function crear({ negocioId, usuarioId, calificacion, comentario }) {
  const { rows } = await pool.query(
    `INSERT INTO resenas (negocio_id, usuario_id, calificacion, comentario)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [negocioId, usuarioId, calificacion, comentario ?? null],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM resenas WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * GET /businesses/{businessId}/reviews (RF-015): solo aprobadas, más
 * recientes primero, paginación keyset (no OFFSET) con `id` como
 * desempate — mismo patrón que negocios.repository.js#listar, incluida
 * la lección de la Épica 4: fecha_creacion_cursor es el texto crudo de
 * Postgres (microsegundos), no un JS Date (que trunca a milisegundos y
 * puede saltarse filas creadas en el mismo milisegundo).
 */
async function listarAprobadas({ negocioId, cursor, limit }) {
  const clausulas = [`negocio_id = $1`, `estado_moderacion = 'aprobada'`];
  const params = [negocioId];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT *, fecha_creacion::text AS fecha_creacion_cursor
     FROM resenas
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion DESC, id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function eliminar(id) {
  await pool.query('DELETE FROM resenas WHERE id = $1', [id]);
}

/**
 * RF-016: un reporte exitoso mueve la reseña a 'pendiente' de inmediato
 * (la saca de GET .../reviews, que solo lista 'aprobada', hasta que la
 * Épica 9 la revise) — sin condicionarlo al estado actual, tal como lo
 * pide CLAUDE.md.
 */
async function marcarPendiente(id) {
  await pool.query("UPDATE resenas SET estado_moderacion = 'pendiente' WHERE id = $1", [id]);
}

/**
 * Calificación promedio y conteo de reseñas APROBADAS de un negocio, para
 * el perfil público (RF-012). Filtra por estado_moderacion='aprobada' —
 * mismo criterio que GET /businesses/{businessId}/reviews — para que una
 * reseña recién creada (estado 'pendiente' por defecto) o rechazada no
 * infle el promedio antes de que un administrador la revise (Épica 9).
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

module.exports = {
  crear,
  buscarPorId,
  listarAprobadas,
  eliminar,
  marcarPendiente,
  obtenerAgregado,
};

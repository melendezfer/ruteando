const pool = require('../config/db');

async function crear({ usuarioId, motivo, comentario }) {
  const { rows } = await pool.query(
    `INSERT INTO solicitudes_eliminacion_cuenta (usuario_id, motivo, comentario)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [usuarioId, motivo ?? null, comentario ?? null],
  );
  return rows[0];
}

/** Base de la idempotencia de POST /users/me/account-deletion-request. */
async function buscarActivaPorUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT * FROM solicitudes_eliminacion_cuenta WHERE usuario_id = $1 AND atendido_en IS NULL`,
    [usuarioId],
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM solicitudes_eliminacion_cuenta WHERE id = $1', [
    id,
  ]);
  return rows[0] || null;
}

/**
 * GET /admin/account-deletion-requests — cola de moderación, FIFO (más
 * antigua primero), mismo criterio y forma que
 * reportesNegocio.repository.js#listarPendientes.
 */
async function listarPendientes({ cursor, limit }) {
  const clausulas = ['atendido_en IS NULL'];
  const params = [];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT *, fecha_creacion::text AS fecha_creacion_cursor
     FROM solicitudes_eliminacion_cuenta
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function marcarAtendida(id) {
  const { rows } = await pool.query(
    'UPDATE solicitudes_eliminacion_cuenta SET atendido_en = now() WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0];
}

module.exports = { crear, buscarActivaPorUsuario, buscarPorId, listarPendientes, marcarAtendida };

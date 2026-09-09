const pool = require('../config/db');

async function crear({ negocioId, usuarioId, ip, motivo }) {
  const { rows } = await pool.query(
    `INSERT INTO reportes_negocio (negocio_id, usuario_id, ip_origen, motivo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [negocioId, usuarioId ?? null, usuarioId ? null : (ip ?? null), motivo],
  );
  return rows[0];
}

/**
 * Cuenta reportes del mismo origen (usuario_id si está autenticado; si
 * no, ip_origen) contra el mismo negocio en los últimos windowMinutes —
 * base del límite de abuso de RF-025 (endpoint público).
 */
async function contarRecientesDelOrigen({ negocioId, usuarioId, ip, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM reportes_negocio
     WHERE negocio_id = $1
       AND fecha_creacion > now() - ($2 || ' minutes')::interval
       AND (
         ($3::uuid IS NOT NULL AND usuario_id = $3::uuid)
         OR
         ($3::uuid IS NULL AND usuario_id IS NULL AND ip_origen = $4::inet)
       )`,
    [negocioId, windowMinutes, usuarioId ?? null, usuarioId ? null : (ip ?? null)],
  );
  return rows[0].total;
}

/**
 * GET /admin/outdated-reports (gap agregado en la Épica 9, ver CLAUDE.md):
 * cola de reportes de "información desactualizada" (RF-025) sin atender
 * todavía. FIFO, mismo criterio que las demás colas de moderación.
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
     FROM reportes_negocio
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function marcarAtendido(id) {
  const { rows } = await pool.query(
    'UPDATE reportes_negocio SET atendido_en = now() WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM reportes_negocio WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = {
  crear,
  contarRecientesDelOrigen,
  listarPendientes,
  marcarAtendido,
  buscarPorId,
};

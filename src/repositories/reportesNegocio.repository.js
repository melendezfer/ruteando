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

module.exports = { crear, contarRecientesDelOrigen };

const pool = require('../config/db');

// Sin RETURNING: eventos es una tabla de alto volumen (ver schema.sql) y
// ningún caller usa la fila insertada — devolverla solo pagaría una
// serialización/round-trip de más (incluyendo metadatos, hasta
// EVENT_METADATA_MAX_BYTES) en cada POST /events.
async function crear({ usuarioId, negocioId, tipo, metadatos, ip }) {
  await pool.query(
    `INSERT INTO eventos (usuario_id, negocio_id, tipo, metadatos, ip_origen)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      usuarioId ?? null,
      negocioId ?? null,
      tipo,
      metadatos ?? null,
      usuarioId ? null : (ip ?? null),
    ],
  );
}

/**
 * Cuenta eventos del mismo origen (usuario_id si está autenticado; si no,
 * ip_origen) en los últimos windowMinutes — base del límite de abuso de
 * RF-013/023 (endpoint público). Mismo patrón que
 * reportesNegocio.repository.js#contarRecientesDelOrigen, pero sin
 * acotar por negocio_id: un mismo origen puede generar eventos sobre
 * muchos negocios distintos en una sola sesión de navegación.
 */
async function contarRecientesDelOrigen({ usuarioId, ip, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM eventos
     WHERE fecha_creacion > now() - ($1 || ' minutes')::interval
       AND (
         ($2::uuid IS NOT NULL AND usuario_id = $2::uuid)
         OR
         ($2::uuid IS NULL AND usuario_id IS NULL AND ip_origen = $3::inet)
       )`,
    [windowMinutes, usuarioId ?? null, usuarioId ? null : (ip ?? null)],
  );
  return rows[0].total;
}

module.exports = { crear, contarRecientesDelOrigen };

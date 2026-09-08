const pool = require('../config/db');

/**
 * El UNIQUE(resena_id, usuario_id) de la tabla es la primera capa de
 * defensa contra RF-016 (ver migración resenas-reportes) — si ya existe
 * un reporte del mismo usuario sobre la misma reseña, esto lanza un
 * error de Postgres (23505) que resenas.service.js traduce a 409.
 */
async function crear({ resenaId, usuarioId }) {
  const { rows } = await pool.query(
    `INSERT INTO reportes_resena (resena_id, usuario_id)
     VALUES ($1, $2)
     RETURNING *`,
    [resenaId, usuarioId],
  );
  return rows[0];
}

/**
 * Segunda capa de defensa: cuenta reportes del mismo usuario (siempre
 * autenticado, RF-016 no es anónimo) en los últimos windowMinutes, sin
 * importar sobre qué reseña — cubre una cuenta reportando muchas reseñas
 * distintas rápido, caso que el UNIQUE de arriba no alcanza a cubrir.
 */
async function contarRecientesDelOrigen({ usuarioId, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM reportes_resena
     WHERE usuario_id = $1 AND fecha_creacion > now() - ($2 || ' minutes')::interval`,
    [usuarioId, windowMinutes],
  );
  return rows[0].total;
}

module.exports = { crear, contarRecientesDelOrigen };

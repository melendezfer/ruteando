const pool = require('../config/db');

/**
 * Calca reportesResena.repository.js (Épica 6): el UNIQUE(foto_id,
 * usuario_id) de la tabla (ver migración fotos-moderacion) es la primera
 * capa de defensa — un segundo reporte del mismo usuario sobre la misma
 * foto lanza 23505, que fotos.service.js traduce a 409.
 */
async function crear({ fotoId, usuarioId }) {
  const { rows } = await pool.query(
    `INSERT INTO reportes_foto (foto_id, usuario_id)
     VALUES ($1, $2)
     RETURNING *`,
    [fotoId, usuarioId],
  );
  return rows[0];
}

/**
 * Segunda capa: cuenta reportes del mismo usuario en los últimos
 * windowMinutes, sin importar sobre qué foto — mismo criterio que
 * reportesResena.repository.js#contarRecientesDelOrigen.
 */
async function contarRecientesDelOrigen({ usuarioId, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM reportes_foto
     WHERE usuario_id = $1 AND fecha_creacion > now() - ($2 || ' minutes')::interval`,
    [usuarioId, windowMinutes],
  );
  return rows[0].total;
}

module.exports = { crear, contarRecientesDelOrigen };

const pool = require('../config/db');

async function existePorId(id) {
  const { rows } = await pool.query('SELECT 1 FROM tipos_oferta WHERE id = $1', [id]);
  return rows.length > 0;
}

/**
 * GET /offer-types (público) — mismo criterio que categorias.repository.js:
 * solo los activos, para que un vendedor no pueda elegir un tipo que el
 * equipo del proyecto ya retiró.
 */
async function listarActivos() {
  const { rows } = await pool.query(
    `SELECT id, nombre, icono, orden_visualizacion, activo, requiere_horario_negocio
     FROM tipos_oferta WHERE activo = true
     ORDER BY orden_visualizacion, nombre`,
  );
  return rows;
}

/**
 * GET /admin/offer-types — el equipo administrador ve también los
 * inactivos (para poder reactivarlos), a diferencia de listarActivos().
 */
async function listarTodos() {
  const { rows } = await pool.query(
    `SELECT id, nombre, icono, orden_visualizacion, activo, requiere_horario_negocio
     FROM tipos_oferta ORDER BY orden_visualizacion, nombre`,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM tipos_oferta WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, icono, ordenVisualizacion, activo, requiereHorarioNegocio }) {
  const { rows } = await pool.query(
    `INSERT INTO tipos_oferta (nombre, icono, orden_visualizacion, activo, requiere_horario_negocio)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nombre, icono ?? null, ordenVisualizacion ?? 0, activo ?? true, requiereHorarioNegocio ?? true],
  );
  return rows[0];
}

/**
 * PATCH /admin/offer-types/{offerTypeId} — mismo patrón que
 * negocios.repository.js#actualizar: el caller ya resolvió "undefined
 * conserva el valor existente" antes de llegar acá (ver
 * tiposOferta.service.js), así que esta función siempre recibe los 4
 * valores finales, nunca undefined.
 */
async function actualizar(id, { nombre, icono, ordenVisualizacion, activo, requiereHorarioNegocio }) {
  const { rows } = await pool.query(
    `UPDATE tipos_oferta
     SET nombre = $2, icono = $3, orden_visualizacion = $4, activo = $5, requiere_horario_negocio = $6
     WHERE id = $1
     RETURNING *`,
    [id, nombre, icono ?? null, ordenVisualizacion, activo, requiereHorarioNegocio],
  );
  return rows[0];
}

module.exports = { existePorId, listarActivos, listarTodos, buscarPorId, crear, actualizar };

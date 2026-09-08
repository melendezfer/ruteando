const pool = require('../config/db');

async function existePorId(id) {
  const { rows } = await pool.query('SELECT 1 FROM categorias WHERE id = $1', [id]);
  return rows.length > 0;
}

async function listar() {
  const { rows } = await pool.query(
    'SELECT id, nombre, icono, orden_visualizacion FROM categorias ORDER BY orden_visualizacion, nombre',
  );
  return rows;
}

module.exports = { existePorId, listar };

const pool = require('../config/db');

async function existePorId(id) {
  const { rows } = await pool.query('SELECT 1 FROM categorias WHERE id = $1', [id]);
  return rows.length > 0;
}

module.exports = { existePorId };

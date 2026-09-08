const pool = require('../config/db');

async function crear({ negocioId, categoriaId, nombre, descripcion, precio, disponible }) {
  const { rows } = await pool.query(
    `INSERT INTO productos (negocio_id, categoria_id, nombre, descripcion, precio, disponible)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [negocioId, categoriaId ?? null, nombre, descripcion ?? null, precio, disponible],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listarPorNegocio(negocioId) {
  const { rows } = await pool.query(
    'SELECT * FROM productos WHERE negocio_id = $1 ORDER BY fecha_creacion',
    [negocioId],
  );
  return rows;
}

async function actualizar(id, { categoriaId, nombre, descripcion, precio, disponible }) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET categoria_id = $2, nombre = $3, descripcion = $4, precio = $5, disponible = $6
     WHERE id = $1
     RETURNING *`,
    [id, categoriaId ?? null, nombre, descripcion ?? null, precio, disponible],
  );
  return rows[0];
}

async function eliminar(id) {
  await pool.query('DELETE FROM productos WHERE id = $1', [id]);
}

module.exports = { crear, buscarPorId, listarPorNegocio, actualizar, eliminar };

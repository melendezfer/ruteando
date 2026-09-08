const pool = require('../config/db');

async function crear({ negocioId, productoId, tipo, url, ordenVisualizacion }) {
  const { rows } = await pool.query(
    `INSERT INTO fotos (negocio_id, producto_id, tipo, url, orden_visualizacion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [negocioId ?? null, productoId ?? null, tipo, url, ordenVisualizacion],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM fotos WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Siguiente orden_visualizacion libre para un negocio o producto (uno de
 * los dos siempre es null, según chk_fotos_referencia). No hay endpoint de
 * reordenamiento en el contrato — el orden se asigna solo, en el orden en
 * que se suben las fotos.
 */
async function siguienteOrden({ negocioId, productoId }) {
  const columna = negocioId ? 'negocio_id' : 'producto_id';
  const valor = negocioId ?? productoId;
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(orden_visualizacion), -1) + 1 AS siguiente
     FROM fotos WHERE ${columna} = $1`,
    [valor],
  );
  return rows[0].siguiente;
}

async function listarPorProducto(productoId) {
  const { rows } = await pool.query('SELECT * FROM fotos WHERE producto_id = $1', [productoId]);
  return rows;
}

async function eliminar(id) {
  await pool.query('DELETE FROM fotos WHERE id = $1', [id]);
}

module.exports = { crear, buscarPorId, siguienteOrden, listarPorProducto, eliminar };

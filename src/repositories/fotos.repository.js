const pool = require('../config/db');

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM fotos WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Calcula el siguiente orden_visualizacion libre e inserta la foto, todo
 * dentro de la misma transacción con un advisory lock por dueño
 * (negocio_id o producto_id, uno de los dos siempre es null según
 * chk_fotos_referencia). Sin el lock, dos subidas casi simultáneas del
 * mismo negocio/producto podían calcular el mismo MAX()+1 antes de que
 * ninguna hubiera insertado — no hay una fila existente que bloquear con
 * FOR UPDATE porque el conflicto es sobre un agregado, no sobre una fila.
 * No hay endpoint de reordenamiento en el contrato — el orden se asigna
 * solo, en el orden en que se suben las fotos.
 */
async function crearConOrdenSiguiente({ negocioId, productoId, tipo, url }) {
  const columna = negocioId ? 'negocio_id' : 'producto_id';
  const valor = negocioId ?? productoId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(valor)]);

    const { rows: ordenRows } = await client.query(
      `SELECT COALESCE(MAX(orden_visualizacion), -1) + 1 AS siguiente
       FROM fotos WHERE ${columna} = $1`,
      [valor],
    );

    const { rows } = await client.query(
      `INSERT INTO fotos (negocio_id, producto_id, tipo, url, orden_visualizacion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [negocioId ?? null, productoId ?? null, tipo, url, ordenRows[0].siguiente],
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listarPorProducto(productoId) {
  const { rows } = await pool.query('SELECT * FROM fotos WHERE producto_id = $1', [productoId]);
  return rows;
}

/**
 * Todas las fotos relacionadas con un negocio para el perfil público
 * (RF-012): las suyas propias (tipo='negocio') y las de cada uno de sus
 * productos (tipo='producto') en un solo viaje a la base de datos, en
 * vez de un N+1 por producto. Photo ya distingue businessId/productId
 * por fila, así que el cliente puede agrupar del lado suyo sin que el
 * contrato necesite anidar fotos dentro de cada producto.
 */
async function listarPorNegocio(negocioId) {
  const { rows } = await pool.query(
    `SELECT f.* FROM fotos f WHERE f.negocio_id = $1
     UNION ALL
     SELECT f.* FROM fotos f JOIN productos p ON p.id = f.producto_id WHERE p.negocio_id = $1
     ORDER BY orden_visualizacion`,
    [negocioId],
  );
  return rows;
}

async function eliminar(id) {
  await pool.query('DELETE FROM fotos WHERE id = $1', [id]);
}

module.exports = {
  crearConOrdenSiguiente,
  buscarPorId,
  listarPorProducto,
  listarPorNegocio,
  eliminar,
};

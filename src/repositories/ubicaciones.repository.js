const pool = require('../config/db');

const SELECT_CON_COORDENADAS = `
  SELECT id, negocio_id, tipo, direccion_referencia, es_actual, fecha_creacion,
         ST_Y(punto::geometry) AS latitud,
         ST_X(punto::geometry) AS longitud
  FROM ubicaciones
`;

async function obtenerActual(negocioId) {
  const { rows } = await pool.query(
    `${SELECT_CON_COORDENADAS} WHERE negocio_id = $1 AND es_actual = true`,
    [negocioId],
  );
  return rows[0] || null;
}

/**
 * Marca la ubicación actual (si existe) como no-actual e inserta la nueva
 * como actual, en una transacción — así el índice único parcial
 * idx_ubicaciones_actual_unica (WHERE es_actual) nunca ve dos filas
 * "actuales" a la vez para el mismo negocio.
 */
async function reemplazarActual({ negocioId, tipo, direccionReferencia, latitud, longitud }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE ubicaciones SET es_actual = false WHERE negocio_id = $1 AND es_actual = true',
      [negocioId],
    );

    const { rows } = await client.query(
      `INSERT INTO ubicaciones (negocio_id, tipo, direccion_referencia, punto, es_actual)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, true)
       RETURNING id, negocio_id, tipo, direccion_referencia, es_actual, fecha_creacion,
                 $5::double precision AS latitud, $4::double precision AS longitud`,
      [negocioId, tipo, direccionReferencia ?? null, longitud, latitud],
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

module.exports = { obtenerActual, reemplazarActual };

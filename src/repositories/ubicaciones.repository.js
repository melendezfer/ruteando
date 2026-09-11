const pool = require('../config/db');

const SELECT_CON_COORDENADAS = `
  SELECT id, negocio_id, tipo, direccion_referencia, es_actual, fecha_creacion,
         mostrar_ubicacion_exacta,
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
async function reemplazarActual({
  negocioId,
  tipo,
  direccionReferencia,
  latitud,
  longitud,
  mostrarUbicacionExacta,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE ubicaciones SET es_actual = false WHERE negocio_id = $1 AND es_actual = true',
      [negocioId],
    );

    const { rows } = await client.query(
      `INSERT INTO ubicaciones (negocio_id, tipo, direccion_referencia, punto, es_actual, mostrar_ubicacion_exacta)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, true, $6)
       RETURNING id, negocio_id, tipo, direccion_referencia, es_actual, fecha_creacion, mostrar_ubicacion_exacta,
                 $5::double precision AS latitud, $4::double precision AS longitud`,
      [negocioId, tipo, direccionReferencia ?? null, longitud, latitud, mostrarUbicacionExacta],
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

/**
 * PATCH /businesses/{businessId}/location/visibility — cambia solo el
 * interruptor "mostrar dirección exacta / zona aproximada" (petición del
 * usuario), sin tocar el punto/tipo/referencia — no pasa por
 * reemplazarActual() porque no es un reemplazo de ubicación, es una
 * preferencia que se puede cambiar "cuando quiera" sin volver a mandar
 * coordenadas. null si el negocio todavía no tiene ninguna ubicación
 * actual (nada que actualizar).
 */
async function actualizarVisibilidad(negocioId, mostrarUbicacionExacta) {
  const { rows } = await pool.query(
    `UPDATE ubicaciones
     SET mostrar_ubicacion_exacta = $2
     WHERE negocio_id = $1 AND es_actual = true
     RETURNING id, negocio_id, tipo, direccion_referencia, es_actual, fecha_creacion, mostrar_ubicacion_exacta,
               ST_Y(punto::geometry) AS latitud, ST_X(punto::geometry) AS longitud`,
    [negocioId, mostrarUbicacionExacta],
  );
  return rows[0] || null;
}

module.exports = { obtenerActual, reemplazarActual, actualizarVisibilidad };

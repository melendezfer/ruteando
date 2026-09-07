const pool = require('../config/db');

async function listar(negocioId) {
  // dia_semana se declaró en schema.sql en orden lunes->domingo, así que
  // ORDER BY dia ya da el orden canónico sin necesitar un CASE aparte.
  const { rows } = await pool.query(
    'SELECT dia, hora_apertura, hora_cierre, cerrado FROM horarios WHERE negocio_id = $1 ORDER BY dia',
    [negocioId],
  );
  return rows;
}

/**
 * Reemplaza el horario semanal completo en una transacción: PUT
 * "Reemplazar el horario semanal completo" (openapi.yaml), no un merge
 * parcial.
 */
async function reemplazarTodos(negocioId, dias) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM horarios WHERE negocio_id = $1', [negocioId]);

    for (const dia of dias) {
      await client.query(
        `INSERT INTO horarios (negocio_id, dia, hora_apertura, hora_cierre, cerrado)
         VALUES ($1, $2, $3, $4, $5)`,
        [negocioId, dia.dia, dia.horaApertura ?? null, dia.horaCierre ?? null, dia.cerrado],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listar, reemplazarTodos };

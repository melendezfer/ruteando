const pool = require('../config/db');
const { condicionRangoHorarioSQL, ligarMomentoActual } = require('./negocios.repository');

const COLUMNAS = `f.id, f.negocio_id, f.dia, f.hora_inicio, f.hora_fin, f.direccion_referencia,
       ST_Y(f.punto::geometry) AS latitud, ST_X(f.punto::geometry) AS longitud`;

/**
 * Franjas del día con ubicación propia de un vendedor ambulante
 * (migración franjas-ubicacion-ambulante), en orden de la semana
 * (dia_semana está declarado lunes->domingo) y luego por hora de inicio.
 */
async function listar(negocioId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM franjas_ubicacion f WHERE f.negocio_id = $1 ORDER BY f.dia, f.hora_inicio, f.id`,
    [negocioId],
  );
  return rows;
}

/**
 * La franja vigente AHORA (o null) — misma regla de rango horario que
 * usan listar()/cercanos() en negocios.repository.js#lateralFranjaActiva,
 * para que el perfil y los listados nunca discrepen sobre dónde está el
 * vendedor en este momento. Solo cuenta si el negocio es 'ambulante'.
 */
async function obtenerActiva(negocioId) {
  const params = [negocioId];
  const idxHorario = ligarMomentoActual(params);
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
     FROM franjas_ubicacion f
     JOIN negocios n ON n.id = f.negocio_id
     WHERE f.negocio_id = $1 AND n.movilidad = 'ambulante' AND (
       ${condicionRangoHorarioSQL(idxHorario, { dia: 'f.dia', inicio: 'f.hora_inicio', fin: 'f.hora_fin' })}
     )
     ORDER BY f.hora_inicio, f.id
     LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Reemplaza todas las franjas en una transacción — mismo contrato que
 * horarios.repository.js#reemplazarTodos (PUT "reemplazar completo", no
 * merge parcial).
 */
async function reemplazarTodas(negocioId, franjas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM franjas_ubicacion WHERE negocio_id = $1', [negocioId]);
    for (const f of franjas) {
      await client.query(
        `INSERT INTO franjas_ubicacion (negocio_id, dia, hora_inicio, hora_fin, punto, direccion_referencia)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)`,
        [negocioId, f.dia, f.horaInicio, f.horaFin, f.longitud, f.latitud, f.direccionReferencia ?? null],
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

module.exports = { listar, obtenerActiva, reemplazarTodas };

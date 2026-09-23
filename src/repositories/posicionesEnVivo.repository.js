const pool = require('../config/db');
const {
  condicionHorarioSQL,
  ligarMomentoActual,
  lateralFranjaActiva,
  lateralPosicionEnVivo,
  COLUMNAS_EN_VIVO,
} = require('./negocios.repository');
const {
  LIVE_LOCATION_TRAIL_MINUTES,
  LIVE_LOCATION_MIN_INTERVAL_SECONDS,
} = require('../config/constants');

/**
 * ¿El negocio está dentro de su horario o de una franja AHORA? Mismo
 * criterio que usa la lectura (negocios.repository.js#lateralPosicionEnVivo)
 * para decidir si una posición en vivo cuenta — el servidor deja de aceptar
 * posiciones exactamente cuando el mapa dejaría de mostrarlas.
 */
async function estaEnHorarioOFranja(negocioId) {
  const params = [negocioId];
  const idxHorario = ligarMomentoActual(params);
  const { rows } = await pool.query(
    `SELECT (fr.id IS NOT NULL OR ${condicionHorarioSQL(idxHorario)}) AS en_horario
     FROM negocios n
     ${lateralFranjaActiva(idxHorario)}
     WHERE n.id = $1`,
    params,
  );
  return Boolean(rows[0]?.en_horario);
}

/**
 * Registra una posición. Descarta (sin error) una que llegue a menos de
 * LIVE_LOCATION_MIN_INTERVAL_SECONDS de la anterior del mismo negocio, y
 * en la misma transacción borra las posiciones de TODOS los negocios con
 * más de LIVE_LOCATION_TRAIL_MINUTES — la tabla nunca guarda más que el
 * rastro que se muestra (limpieza perezosa, sin cron). Devuelve true si
 * se guardó.
 */
async function registrar({ negocioId, latitud, longitud }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa las posiciones concurrentes del mismo negocio (dos pestañas
    // abiertas del mismo vendedor) para que el chequeo de intervalo mínimo
    // no deje pasar dos casi simultáneas.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vivo:${negocioId}`]);
    const reciente = await client.query(
      `SELECT 1 FROM posiciones_en_vivo
       WHERE negocio_id = $1 AND registrada_en > now() - make_interval(secs => $2)
       LIMIT 1`,
      [negocioId, LIVE_LOCATION_MIN_INTERVAL_SECONDS],
    );
    let guardada = false;
    if (reciente.rows.length === 0) {
      await client.query(
        `INSERT INTO posiciones_en_vivo (negocio_id, punto)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)`,
        [negocioId, longitud, latitud],
      );
      guardada = true;
    }
    await client.query(
      `DELETE FROM posiciones_en_vivo WHERE registrada_en < now() - make_interval(mins => $1)`,
      [LIVE_LOCATION_TRAIL_MINUTES],
    );
    await client.query('COMMIT');
    return guardada;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Apagar el interruptor: borra en el acto todo el rastro del negocio. */
async function borrarDeNegocio(negocioId) {
  await pool.query('DELETE FROM posiciones_en_vivo WHERE negocio_id = $1', [negocioId]);
}

/**
 * La posición en vivo vigente (con su rastro) para el perfil de un
 * negocio — la MISMA subconsulta que usan los listados, para que el
 * perfil y el mapa nunca discrepen. null si no está en vivo ahora.
 */
async function obtenerVigente(negocioId) {
  const params = [negocioId];
  const idxHorario = ligarMomentoActual(params);
  const { rows } = await pool.query(
    `SELECT ST_Y(vivo.punto::geometry) AS latitud, ST_X(vivo.punto::geometry) AS longitud,
            ${COLUMNAS_EN_VIVO}
     FROM negocios n
     ${lateralFranjaActiva(idxHorario)}
     ${lateralPosicionEnVivo(idxHorario)}
     WHERE n.id = $1 AND vivo.punto IS NOT NULL`,
    params,
  );
  return rows[0] ?? null;
}

module.exports = { estaEnHorarioOFranja, registrar, borrarDeNegocio, obtenerVigente };

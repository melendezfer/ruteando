const pool = require('../config/db');

/**
 * "Tu semana" del tablero (docs/specs/perfil-2.md §4.4, §7.4): conteos de UN
 * negocio en dos ventanas seguidas de `dias` días (la actual y la anterior).
 * Solo cifras agregadas — nunca quién visitó (sin usuario_id ni IP).
 *
 * Eventos por (negocio_id, tipo, fecha_creacion): usa
 * idx_eventos_negocio_tipo_fecha (prueba de plan en
 * tests/integration/estadisticasNegocio.test.js).
 */
const SQL_EVENTOS = `
  SELECT
    count(*) FILTER (WHERE tipo = 'vista_negocio' AND fecha_creacion >= now() - make_interval(days => $2)) AS vistas_actual,
    count(*) FILTER (WHERE tipo = 'vista_negocio' AND fecha_creacion <  now() - make_interval(days => $2)) AS vistas_anterior,
    count(*) FILTER (WHERE tipo IN ('clic_contacto', 'clic_como_llegar') AND fecha_creacion >= now() - make_interval(days => $2)) AS contactos_actual,
    count(*) FILTER (WHERE tipo IN ('clic_contacto', 'clic_como_llegar') AND fecha_creacion <  now() - make_interval(days => $2)) AS contactos_anterior
  FROM eventos
  WHERE negocio_id = $1
    AND tipo IN ('vista_negocio', 'clic_contacto', 'clic_como_llegar')
    AND fecha_creacion >= now() - make_interval(days => $2 * 2)`;

async function contarEventos(negocioId, dias) {
  const { rows } = await pool.query(SQL_EVENTOS, [negocioId, dias]);
  return rows[0];
}

/** Para la prueba de plan de ejecución. */
async function explicarEventos(negocioId, dias) {
  const { rows } = await pool.query(`EXPLAIN (FORMAT JSON) ${SQL_EVENTOS}`, [negocioId, dias]);
  return rows[0]['QUERY PLAN'][0];
}

/**
 * Calificaciones aprobadas (las mismas que cuentan para el promedio público)
 * recibidas en cada ventana, y reseñas que esperan revisión hoy.
 */
async function resumirResenas(negocioId, dias) {
  const { rows } = await pool.query(
    `SELECT
       avg(calificacion) FILTER (WHERE estado_moderacion = 'aprobada' AND fecha_creacion >= now() - make_interval(days => $2)) AS promedio_actual,
       count(*)          FILTER (WHERE estado_moderacion = 'aprobada' AND fecha_creacion >= now() - make_interval(days => $2)) AS total_actual,
       avg(calificacion) FILTER (WHERE estado_moderacion = 'aprobada' AND fecha_creacion <  now() - make_interval(days => $2)
                                   AND fecha_creacion >= now() - make_interval(days => $2 * 2)) AS promedio_anterior,
       count(*)          FILTER (WHERE estado_moderacion = 'aprobada' AND fecha_creacion <  now() - make_interval(days => $2)
                                   AND fecha_creacion >= now() - make_interval(days => $2 * 2)) AS total_anterior,
       count(*)          FILTER (WHERE estado_moderacion = 'pendiente') AS pendientes
     FROM resenas
     WHERE negocio_id = $1`,
    [negocioId, dias],
  );
  return rows[0];
}

module.exports = { contarEventos, explicarEventos, resumirResenas };

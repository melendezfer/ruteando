const pool = require('../config/db');
const { AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES } = require('../config/constants');
const { diaAnterior, momentoActualBogota } = require('../services/disponibilidad.service');

// favoritos.PRIMARY KEY (usuario_id, negocio_id) ya impide duplicados —
// ON CONFLICT DO NOTHING es lo que hace idempotente el POST (marcar dos
// veces el mismo negocio no es error, ver plan de la Épica 7).
async function marcar(usuarioId, negocioId) {
  await pool.query(
    `INSERT INTO favoritos (usuario_id, negocio_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario_id, negocio_id) DO NOTHING`,
    [usuarioId, negocioId],
  );
}

// Un DELETE sin filas afectadas ya es un no-op silencioso — no hace
// falta verificar antes si el favorito existía (mismo criterio de
// idempotencia que marcar()).
async function desmarcar(usuarioId, negocioId) {
  await pool.query('DELETE FROM favoritos WHERE usuario_id = $1 AND negocio_id = $2', [
    usuarioId,
    negocioId,
  ]);
}

/**
 * GET /users/me/favorites: negocios favoritos del usuario, más
 * recientes primero (según cuándo se marcaron, no la fecha de creación
 * del negocio). Paginación keyset con negocio_id como desempate —
 * favoritos no tiene columna id propia (PK compuesta), así que no hay un
 * "id" que reusar como en negocios/resenas.
 */
/**
 * Business.availabilityConfirmedAt (sección 11/37 de CLAUDE.md, decisión
 * B — "se muestra en todos los listados") — mismo LEFT JOIN LATERAL que
 * negocios.repository.js#listar/cercanos, duplicado a propósito en vez
 * de importado de ahí: cada repositorio de este proyecto es
 * autosuficiente (agregarFiltrosComunes tampoco se comparte entre
 * archivos), y es solo 6 líneas de SQL.
 */
async function listar({ usuarioId, cursor, limit, openNow }) {
  const clausulas = ['f.usuario_id = $1'];
  const params = [usuarioId, AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES];
  const idxFrescura = 2;

  if (openNow) {
    // Misma regla que negocios.repository.js#agregarFiltrosComunes (sin
    // RF asociado, petición directa del usuario — banner de
    // descubrimiento, familia "Favoritos abiertos ahora"): un turno
    // nocturno (hora_apertura > hora_cierre) queda guardado bajo el día
    // en que empieza, así que hace falta revisar también la fila de
    // "ayer" para la mitad del turno que cae después de medianoche.
    // Duplicado a propósito, no importado de ahí — cada repositorio de
    // este proyecto es autosuficiente (mismo criterio ya documentado
    // para el LEFT JOIN LATERAL de disponibilidad, más abajo).
    const { hoyDb, horaActual } = momentoActualBogota();
    const ayerDb = diaAnterior(hoyDb);
    params.push(hoyDb, ayerDb, horaActual);
    const [pHoy, pAyer, pAhora] = [params.length - 2, params.length - 1, params.length];
    clausulas.push(`EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.negocio_id = n.id AND h.cerrado = false AND (
           (h.dia = $${pHoy}::dia_semana  AND h.hora_apertura <= h.hora_cierre AND $${pAhora}::time BETWEEN h.hora_apertura AND h.hora_cierre)
        OR (h.dia = $${pHoy}::dia_semana  AND h.hora_apertura >  h.hora_cierre AND $${pAhora}::time >= h.hora_apertura)
        OR (h.dia = $${pAyer}::dia_semana AND h.hora_apertura >  h.hora_cierre AND $${pAhora}::time <= h.hora_cierre)
      )
    )`);
  }

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.negocioId);
    clausulas.push(
      `(f.fecha_creacion, f.negocio_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    // ub.latitud/longitud/mostrar_ubicacion_exacta (sin RF asociado,
    // petición directa del usuario — banner de descubrimiento, familia
    // "Favoritos abiertos ahora"): mismo LEFT JOIN LATERAL que
    // negocios.repository.js#listar/cercanos, duplicado a propósito
    // (mismo criterio ya documentado arriba para el de disponibilidad).
    // Faltaba desde que existe este endpoint — `SELECT n.*` solo trae
    // columnas de `negocios`, nunca de `ubicaciones`, así que
    // toApiBusiness() mapeaba latitude/longitude siempre null acá (no
    // afecta a averageRating/reviewCount/etc., que tampoco dependen de
    // esta tabla) — sin coordenadas, un favorito nunca podía aparecer
    // como pin en el mapa ni ofrecer "Cómo llegar".
    `SELECT n.*, f.fecha_creacion::text AS favorito_fecha_creacion_cursor,
            ub.latitud, ub.longitud, ub.mostrar_ubicacion_exacta,
            disp.respondida_en AS disponibilidad_confirmada_en
     FROM favoritos f
     JOIN negocios n ON n.id = f.negocio_id
     LEFT JOIN LATERAL (
       SELECT ST_Y(u.punto::geometry) AS latitud, ST_X(u.punto::geometry) AS longitud, u.mostrar_ubicacion_exacta
       FROM ubicaciones u WHERE u.negocio_id = n.id AND u.es_actual = true
       LIMIT 1
     ) ub ON true
     LEFT JOIN LATERAL (
       SELECT sd.respondida_en
       FROM solicitudes_disponibilidad sd
       WHERE sd.negocio_id = n.id AND sd.decision = 'confirmada'
         AND sd.respondida_en > now() - ($${idxFrescura} || ' minutes')::interval
       ORDER BY sd.respondida_en DESC
       LIMIT 1
     ) disp ON true
     WHERE ${clausulas.join(' AND ')}
     ORDER BY f.fecha_creacion DESC, f.negocio_id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

module.exports = { marcar, desmarcar, listar };

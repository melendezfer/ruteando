const pool = require('../config/db');
const { AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES } = require('../config/constants');

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
async function listar({ usuarioId, cursor, limit }) {
  const clausulas = ['f.usuario_id = $1'];
  const params = [usuarioId, AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES];
  const idxFrescura = 2;

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.negocioId);
    clausulas.push(
      `(f.fecha_creacion, f.negocio_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT n.*, f.fecha_creacion::text AS favorito_fecha_creacion_cursor,
            disp.respondida_en AS disponibilidad_confirmada_en
     FROM favoritos f
     JOIN negocios n ON n.id = f.negocio_id
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

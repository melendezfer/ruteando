const pool = require('../config/db');

// `etiquetas` es un array de un enum propio (etiqueta_resena[]) — el driver
// `pg` no conoce el OID dinámico que Postgres le asigna a un array de un
// tipo definido por el usuario, así que sin este cast explícito devuelve
// el literal crudo de Postgres como string ("{comida_fria}") en vez de un
// array JS, y business.mapper.js#toApiReview/toApiReviewFeedback truena al
// llamar .map() sobre él. `SELECT *, etiquetas::text[] AS etiquetas` no es
// ambiguo: con dos columnas del mismo nombre, `pg` arma el objeto de fila
// asignando en orden, así que la segunda (el cast) es la que queda.
const SELECT_RESENA = 'SELECT *, etiquetas::text[] AS etiquetas';

/**
 * Calificar (Perfil 2.0 §3.6, regla del usuario 2026-10-03): se publica al
 * instante ('aprobada') y hay UNA por persona y negocio — calificar de nuevo
 * reemplaza la anterior (estrellas, etiquetas y comentario) y la deja
 * publicada otra vez. Los reportes de la versión anterior se borran: eran
 * sobre otro contenido. La moderación queda solo para lo reportado
 * (reportar la pasa a 'pendiente'). `insertada` dice si es nueva (201) o
 * un reemplazo (200).
 */
async function crearOReemplazar({ negocioId, usuarioId, calificacion, etiquetas, comentarioPrivado }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO resenas (negocio_id, usuario_id, calificacion, etiquetas, comentario_privado, estado_moderacion)
       VALUES ($1, $2, $3, $4::etiqueta_resena[], $5, 'aprobada')
       ON CONFLICT (negocio_id, usuario_id) DO UPDATE
         SET calificacion = EXCLUDED.calificacion,
             etiquetas = EXCLUDED.etiquetas,
             comentario_privado = EXCLUDED.comentario_privado,
             estado_moderacion = 'aprobada',
             fecha_creacion = now()
       RETURNING *, etiquetas::text[] AS etiquetas, (xmax = 0) AS insertada`,
      [negocioId, usuarioId, calificacion, etiquetas ?? [], comentarioPrivado ?? null],
    );
    if (!rows[0].insertada) {
      await client.query('DELETE FROM reportes_resena WHERE resena_id = $1', [rows[0].id]);
    }
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`${SELECT_RESENA} FROM resenas WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * GET /businesses/{businessId}/feedback — retroalimentación privada que
 * solo ve el dueño del negocio (resenas.service.js#listarFeedbackPrivado
 * ya verificó la propiedad antes de llegar acá). A diferencia de la
 * antigua listarAprobadas() (pública, eliminada en este rediseño — ver
 * CLAUDE.md), no filtra por 'aprobada': el dueño recibe el aporte de
 * inmediato, sin esperar a que un administrador apruebe la calificación
 * para que cuente en el promedio público (obtenerAgregado, sin cambios,
 * sigue exigiendo 'aprobada' solo para ESE agregado). Solo se excluye
 * 'rechazada' — contenido que un administrador ya determinó abusivo o
 * inapropiado (RF-016) no debe seguir mostrándose al vendedor. Mismo
 * patrón de paginación keyset que el resto del proyecto.
 */
async function listarFeedbackPrivado({ negocioId, cursor, limit }) {
  const clausulas = [`negocio_id = $1`, `estado_moderacion <> 'rechazada'`];
  const params = [negocioId];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `${SELECT_RESENA}, fecha_creacion::text AS fecha_creacion_cursor
     FROM resenas
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion DESC, id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/**
 * GET /users/me/reviews (Épica F6, agregado junto con su definición
 * OpenAPI — no existía ninguna ruta para "mis reseñas" hasta esta
 * épica, mismo criterio que RF-025 en la Épica 2). Sin filtro de
 * estado_moderacion: son las propias
 * reseñas del usuario, tiene sentido que vea también las que están
 * pendientes o fueron rechazadas, igual que ya puede borrar cualquiera
 * de ellas sin importar su estado (resenas.service.js#eliminar). Se
 * incluye el nombre del negocio vía JOIN para que el frontend no tenga
 * que resolverlo con una llamada aparte por cada reseña (mismo criterio
 * que perfilNegocio.service.js evitando N+1).
 */
async function listarPorUsuario({ usuarioId, cursor, limit }) {
  const clausulas = [`r.usuario_id = $1`];
  const params = [usuarioId];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(r.fecha_creacion, r.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT r.*, r.etiquetas::text[] AS etiquetas, r.fecha_creacion::text AS fecha_creacion_cursor, n.nombre AS negocio_nombre
     FROM resenas r
     JOIN negocios n ON n.id = r.negocio_id
     WHERE ${clausulas.join(' AND ')}
     ORDER BY r.fecha_creacion DESC, r.id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function eliminar(id) {
  await pool.query('DELETE FROM resenas WHERE id = $1', [id]);
}

/**
 * RF-016: un reporte exitoso mueve la reseña a 'pendiente' de inmediato
 * (la saca del agregado público, que solo cuenta 'aprobada', hasta que la
 * Épica 9 la revise) — sin condicionarlo al estado actual, tal como lo
 * pide CLAUDE.md. Sigue visible en la retroalimentación privada del dueño
 * (listarFeedbackPrivado excluye solo 'rechazada') — es exactamente la
 * separación que motivó el rediseño de reseñas, ver CLAUDE.md.
 */
async function marcarPendiente(id) {
  await pool.query("UPDATE resenas SET estado_moderacion = 'pendiente' WHERE id = $1", [id]);
}

/**
 * Calificación promedio y conteo de reseñas APROBADAS de un negocio, para
 * el perfil público (RF-012) — la ÚNICA señal pública sobre reseñas desde
 * el rediseño (ver CLAUDE.md). Desde 2026-10-03 una calificación nace
 * 'aprobada' (se publica al instante); solo una REPORTADA ('pendiente') o
 * rechazada por el administrador queda fuera del promedio.
 */
/**
 * GET /admin/reviews/reported (RF-021): reseñas con
 * estado_moderacion='pendiente' — desde 2026-10-03 una calificación nace
 * 'aprobada' y solo pasa a 'pendiente' al ser reportada, así que esta cola
 * es exactamente "lo reportado". FIFO (más antigua primero), igual que
 * negocios.repository.js#listarPendientes.
 */
async function listarPendientes({ cursor, limit }) {
  const clausulas = [`estado_moderacion = 'pendiente'`];
  const params = [];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `${SELECT_RESENA}, fecha_creacion::text AS fecha_creacion_cursor
     FROM resenas
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/**
 * RF-021: sin filtro de estado en el UPDATE — resenas.service.js valida
 * que la reseña esté 'pendiente' antes de llamar (mismo patrón fetch ->
 * validar -> mutar que negocios.repository.js#aprobar/rechazar).
 */
async function moderar(id, estadoModeracion) {
  const { rows } = await pool.query(
    'UPDATE resenas SET estado_moderacion = $2 WHERE id = $1 RETURNING *, etiquetas::text[] AS etiquetas',
    [id, estadoModeracion],
  );
  return rows[0];
}

async function obtenerAgregado(negocioId) {
  const { rows } = await pool.query(
    `SELECT AVG(calificacion)::float AS promedio, count(*)::int AS total
     FROM resenas
     WHERE negocio_id = $1 AND estado_moderacion = 'aprobada'`,
    [negocioId],
  );
  return rows[0];
}

module.exports = {
  crearOReemplazar,
  buscarPorId,
  listarFeedbackPrivado,
  listarPorUsuario,
  eliminar,
  marcarPendiente,
  obtenerAgregado,
  listarPendientes,
  moderar,
};

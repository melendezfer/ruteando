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

async function crear({ negocioId, usuarioId, calificacion, etiquetas, comentarioPrivado }) {
  const { rows } = await pool.query(
    `INSERT INTO resenas (negocio_id, usuario_id, calificacion, etiquetas, comentario_privado)
     VALUES ($1, $2, $3, $4::etiqueta_resena[], $5)
     RETURNING *, etiquetas::text[] AS etiquetas`,
    [negocioId, usuarioId, calificacion, etiquetas ?? [], comentarioPrivado ?? null],
  );
  return rows[0];
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
 * el rediseño (ver CLAUDE.md). Filtra por estado_moderacion='aprobada'
 * para que una reseña recién creada (estado 'pendiente' por defecto) o
 * rechazada no infle el promedio antes de que un administrador la revise
 * (Épica 9) — a diferencia de listarFeedbackPrivado(), que sí las incluye
 * porque esa retroalimentación es privada, no pública.
 */
/**
 * GET /admin/reviews/reported (RF-021): la cola real es "toda reseña con
 * estado_moderacion='pendiente'", no solo las que pasaron por
 * reportes_resena — toda reseña nueva nace pendiente (ver
 * resenas.repository.js#crear, sin estado explícito -> default de la
 * columna) y solo un administrador puede moverla a aprobada; el nombre de
 * la ruta viene de la especificación original, no de un filtro por tabla
 * de reportes. FIFO (más antigua primero), igual que
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
  crear,
  buscarPorId,
  listarFeedbackPrivado,
  listarPorUsuario,
  eliminar,
  marcarPendiente,
  obtenerAgregado,
  listarPendientes,
  moderar,
};

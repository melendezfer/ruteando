const pool = require('../config/db');

async function crear({ negocioId, usuarioId, expiraEn }) {
  const { rows } = await pool.query(
    `INSERT INTO solicitudes_disponibilidad (negocio_id, usuario_id, expira_en)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [negocioId, usuarioId, expiraEn],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM solicitudes_disponibilidad WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Sin filtro de estado en el UPDATE — solicitudesDisponibilidad.service.js
 * valida que la solicitud siga pendiente (ni respondida ni expirada) antes
 * de llamar, mismo patrón fetch -> validar -> mutar que el resto del
 * proyecto.
 */
async function responder(id, decisionDb) {
  const { rows } = await pool.query(
    `UPDATE solicitudes_disponibilidad
     SET decision = $2, respondida_en = now()
     WHERE id = $1
     RETURNING *`,
    [id, decisionDb],
  );
  return rows[0];
}

/**
 * Capa de rate limit por negocio (protege al vendedor de que lo saturen
 * de push, sin importar cuántos consumidores distintos preguntan).
 */
async function contarRecientesPorNegocio({ negocioId, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM solicitudes_disponibilidad
     WHERE negocio_id = $1 AND fecha_creacion > now() - ($2 || ' minutes')::interval`,
    [negocioId, windowMinutes],
  );
  return rows[0].total;
}

/**
 * Capa de rate limit por usuario solicitante (protege contra una sola
 * cuenta acosando a varios negocios distintos) — mismo criterio que
 * reportesResena.repository.js#contarRecientesDelOrigen.
 */
async function contarRecientesPorUsuario({ usuarioId, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM solicitudes_disponibilidad
     WHERE usuario_id = $1 AND fecha_creacion > now() - ($2 || ' minutes')::interval`,
    [usuarioId, windowMinutes],
  );
  return rows[0].total;
}

/**
 * GET /businesses/{businessId} (RF-012, +availabilityConfirmedAt): la
 * confirmación más reciente de este negocio, solo si sigue "fresca"
 * (dentro de freshnessMinutes) — usa idx_solicitudes_disponibilidad_confirmadas.
 * null si no hay ninguna confirmación vigente.
 */
async function obtenerConfirmacionFresca(negocioId, freshnessMinutes) {
  const { rows } = await pool.query(
    `SELECT respondida_en
     FROM solicitudes_disponibilidad
     WHERE negocio_id = $1 AND decision = 'confirmada'
       AND respondida_en > now() - ($2 || ' minutes')::interval
     ORDER BY respondida_en DESC
     LIMIT 1`,
    [negocioId, freshnessMinutes],
  );
  return rows[0]?.respondida_en ?? null;
}

// GET /businesses/{businessId}/availability-requests (Fase 3, sin RF
// asociado — ver CLAUDE.md sección 37). "pending"/"expired" no son
// valores guardados (expiración perezosa, ver cabecera del archivo) —
// se calculan acá contra el reloj, igual que toApiRequest() en
// solicitudesDisponibilidad.service.js hace por fila individual.
const CLAUSULA_POR_ESTADO = {
  pending: `decision IS NULL AND expira_en > now()`,
  confirmed: `decision = 'confirmada'`,
  declined: `decision = 'rechazada'`,
  expired: `decision IS NULL AND expira_en <= now()`,
};

/**
 * FIFO (más antigua primero) — a diferencia de la mayoría de las listas
 * del proyecto (más recientes primero): estas solicitudes expiran a los
 * 10 minutos (AVAILABILITY_REQUEST_TTL_MINUTES), así que la más antigua
 * es la más urgente de responder, no la menos relevante.
 */
async function listarPorNegocio({ negocioId, status, cursor, limit }) {
  const clausulas = ['negocio_id = $1'];
  const params = [negocioId];

  if (status) {
    clausulas.push(CLAUSULA_POR_ESTADO[status]);
  }

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT *, fecha_creacion::text AS fecha_creacion_cursor
     FROM solicitudes_disponibilidad
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

module.exports = {
  crear,
  buscarPorId,
  responder,
  contarRecientesPorNegocio,
  contarRecientesPorUsuario,
  obtenerConfirmacionFresca,
  listarPorNegocio,
};

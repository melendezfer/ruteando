const solicitudesRepo = require('../repositories/solicitudesEliminacionCuenta.repository');

// "Solicitar eliminación de mi cuenta y mis datos" (Configuración, Épica
// F6) — español en DB, inglés en el contrato, mismo criterio que
// business.mapper.js con los 8 enums del Documento 07 (esta funcionalidad
// es posterior, pero se sigue la misma convención para no romper la
// consistencia del proyecto).
const REASON_API_TO_DB = {
  no_longer_needed: 'ya_no_lo_necesito',
  could_not_find_what_i_needed: 'no_encontre_lo_que_buscaba',
  technical_problem: 'problema_tecnico',
  other: 'otro',
};
const REASON_DB_TO_API = Object.fromEntries(
  Object.entries(REASON_API_TO_DB).map(([api, db]) => [db, api]),
);

// Código de Postgres para unique_violation — mismo criterio que
// resenas.service.js/reportesResena.repository.js.
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Reusada por admin.service.js (GET /admin/account-deletion-requests,
 * PATCH .../resolve) — mismo shape que devuelve solicitar().
 *
 * userId queda null una vez que la cuenta se elimine de verdad
 * (usuario_id tiene ON DELETE SET NULL, ver la migración) — reason y
 * comment, si los hay, sobreviven como retroalimentación de producto
 * sin ningún dato personal asociado.
 */
function toApiRequest(row) {
  return {
    id: row.id,
    userId: row.usuario_id,
    reason: row.motivo ? REASON_DB_TO_API[row.motivo] : null,
    comment: row.comentario,
    createdAt: row.fecha_creacion,
    attendedAt: row.atendido_en,
  };
}

/**
 * POST /users/me/account-deletion-request. La cuenta NO se elimina acá
 * — esto solo registra la solicitud (Ley 1581 exige un plazo de
 * procesamiento, no un borrado inmediato); el borrado real de datos
 * personales queda para cuando se aborde la Épica 9 (o un proceso
 * manual mientras tanto), a partir de la cola que expone
 * admin.service.js#listarSolicitudesEliminacionCuenta.
 *
 * Idempotente: si ya existe una solicitud activa (sin atender) para
 * este usuario, la devuelve tal cual en vez de crear una segunda — así
 * un doble clic en el botón de Configuración no es un error confuso
 * para quien ya está por salir. El índice único parcial
 * idx_solicitudes_eliminacion_activa_por_usuario es el respaldo real
 * contra la carrera de dos pestañas a la vez (el catch de abajo).
 */
async function solicitar(usuarioId, { reason, comment }) {
  const activa = await solicitudesRepo.buscarActivaPorUsuario(usuarioId);
  if (activa) {
    return toApiRequest(activa);
  }

  const motivo = reason ? REASON_API_TO_DB[reason] : null;

  try {
    const fila = await solicitudesRepo.crear({ usuarioId, motivo, comentario: comment });
    return toApiRequest(fila);
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      const existente = await solicitudesRepo.buscarActivaPorUsuario(usuarioId);
      if (existente) return toApiRequest(existente);
    }
    throw err;
  }
}

module.exports = { solicitar, toApiRequest };

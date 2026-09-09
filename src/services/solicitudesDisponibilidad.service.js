const negociosService = require('./negocios.service');
const solicitudesRepo = require('../repositories/solicitudesDisponibilidad.repository');
const consentimientosRepo = require('../repositories/consentimientos.repository');
const pushService = require('./push.service');
const { NotFoundError, ForbiddenError, ConflictError, TooManyRequestsError } = require('../errors');
const {
  AVAILABILITY_REQUEST_TTL_MINUTES,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_WINDOW_MINUTES,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_WINDOW_MINUTES,
} = require('../config/constants');

// AvailabilityRequestDecisionInput.decision (openapi.yaml) usa inglés;
// decision_disponibilidad (schema, ver migración disponibilidad-tiempo-real)
// usa español — mismo principio que business.mapper.js.
const DECISION_API_TO_DB = { confirmed: 'confirmada', declined: 'rechazada' };
const DECISION_DB_TO_API = { confirmada: 'confirmed', rechazada: 'declined' };

/**
 * Expiración perezosa (sin cron, ver CLAUDE.md): "expired" nunca se
 * escribe en la fila, se calcula acá comparando expira_en contra el
 * reloj — mismo criterio que registroAsistido.service.js#reclamar con
 * codigos_recuperacion.
 */
function toApiRequest(row) {
  let status;
  if (row.decision) {
    status = DECISION_DB_TO_API[row.decision];
  } else if (new Date(row.expira_en).getTime() > Date.now()) {
    status = 'pending';
  } else {
    status = 'expired';
  }

  return {
    id: row.id,
    businessId: row.negocio_id,
    userId: row.usuario_id,
    status,
    createdAt: row.fecha_creacion,
    expiresAt: row.expira_en,
    respondedAt: row.respondida_en,
  };
}

/**
 * POST /businesses/{businessId}/availability-requests. Sin exclusividad a
 * propósito (decisión explícita, ver conversación de planeación):
 * cualquier número de solicitudes pendientes simultáneas sobre el mismo
 * negocio es válido, protegido solo por el rate limit por negocio_id —
 * bloquear al segundo consumidor que pregunta por un negocio popular en
 * hora pico perjudicaría el caso de mayor valor de esta función.
 */
async function solicitar(usuarioId, negocioId) {
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);

  if (negocio.estado !== 'activo') {
    throw new ConflictError(
      'Solo se puede pedir confirmación de disponibilidad a un negocio activo',
    );
  }

  // Mismo abuso obvio que resenas.service.js#crear contra el propio
  // negocio: un vendedor no puede pedirse confirmación a sí mismo.
  if (negocio.usuario_id === usuarioId) {
    throw new ForbiddenError(
      'No puede solicitar confirmación de disponibilidad de su propio negocio',
    );
  }

  const tieneNotificaciones = await consentimientosRepo.existeConsentimiento(
    negocio.usuario_id,
    'notificaciones',
  );
  if (!tieneNotificaciones) {
    throw new ConflictError('El vendedor no ha habilitado notificaciones');
  }

  const [recientesPorNegocio, recientesPorUsuario] = await Promise.all([
    solicitudesRepo.contarRecientesPorNegocio({
      negocioId,
      windowMinutes: AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_WINDOW_MINUTES,
    }),
    solicitudesRepo.contarRecientesPorUsuario({
      usuarioId,
      windowMinutes: AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_WINDOW_MINUTES,
    }),
  ]);

  if (recientesPorNegocio >= AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX) {
    throw new TooManyRequestsError(
      `Este negocio ya recibió demasiadas solicitudes recientes (máximo ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX} por ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_WINDOW_MINUTES} min)`,
    );
  }
  if (recientesPorUsuario >= AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX) {
    throw new TooManyRequestsError(
      `Ya hizo demasiadas solicitudes recientes (máximo ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX} por ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_WINDOW_MINUTES} min)`,
    );
  }

  const expiraEn = new Date(Date.now() + AVAILABILITY_REQUEST_TTL_MINUTES * 60 * 1000);
  const solicitud = await solicitudesRepo.crear({ negocioId, usuarioId, expiraEn });

  // Best-effort: un fallo al enviar el push nunca tumba la solicitud, que
  // ya es real y consultable aunque el aviso no llegue a ningún
  // dispositivo (ver push.service.js).
  await pushService.enviarAUsuario(negocio.usuario_id, {
    title: '¿Sigues vendiendo?',
    body: `Un cliente quiere saber si "${negocio.nombre}" está vendiendo ahora mismo.`,
    data: { type: 'availability_request', requestId: solicitud.id, businessId: negocioId },
  });

  return toApiRequest(solicitud);
}

async function obtenerCrudoOFallar(id) {
  const solicitud = await solicitudesRepo.buscarPorId(id);
  if (!solicitud) {
    throw new NotFoundError('Solicitud no encontrada');
  }
  return solicitud;
}

/**
 * GET /availability-requests/{requestId}: solo el consumidor que
 * preguntó o el dueño del negocio tienen interés legítimo en verla —
 * autorización a nivel de objeto, regla de seguridad #2.
 */
async function obtener(id, requesterId) {
  const solicitud = await obtenerCrudoOFallar(id);
  const negocio = await negociosService.obtenerCrudoOFallar(solicitud.negocio_id);

  if (requesterId !== solicitud.usuario_id && requesterId !== negocio.usuario_id) {
    throw new ForbiddenError('No tiene acceso a esta solicitud');
  }

  return toApiRequest(solicitud);
}

/**
 * PATCH /availability-requests/{requestId}/respond. 409 si ya tiene
 * decision o si ya expiró — fetch -> validar estado -> mutar, mismo
 * patrón que toda transición de estado de la Épica 9.
 */
async function responder(id, vendedorId, decisionApi) {
  const solicitud = await obtenerCrudoOFallar(id);
  const negocio = await negociosService.obtenerCrudoOFallar(solicitud.negocio_id);
  negociosService.verificarPropietario(negocio, vendedorId);

  const yaExpirada = !solicitud.decision && new Date(solicitud.expira_en).getTime() <= Date.now();
  if (solicitud.decision || yaExpirada) {
    throw new ConflictError('La solicitud ya no está pendiente');
  }

  const actualizada = await solicitudesRepo.responder(id, DECISION_API_TO_DB[decisionApi]);
  return toApiRequest(actualizada);
}

module.exports = { solicitar, obtener, responder };

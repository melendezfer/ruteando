const reportesRepo = require('../repositories/reportesNegocio.repository');
const { obtenerCrudoOFallar } = require('./negocios.service');
const { TooManyRequestsError } = require('../errors');
const {
  OUTDATED_REPORT_RATE_LIMIT_MAX,
  OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');

// Reusado también por admin.service.js (Épica 9: GET /admin/outdated-reports
// y POST /admin/outdated-reports/{reportId}/resolve) — mismo shape que ya
// devolvía crear(), con attendedAt agregado (null hasta que un
// administrador lo marque atendido).
function toApiReport(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    reason: row.motivo,
    createdAt: row.fecha_creacion,
    attendedAt: row.atendido_en,
  };
}

async function crear({ negocioId, usuarioId, ip, reason }) {
  await obtenerCrudoOFallar(negocioId);

  const recientes = await reportesRepo.contarRecientesDelOrigen({
    negocioId,
    usuarioId,
    ip,
    windowMinutes: OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  });

  if (recientes >= OUTDATED_REPORT_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError(
      `Ya reportó este negocio ${OUTDATED_REPORT_RATE_LIMIT_MAX} veces en los últimos ${OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES} minutos`,
    );
  }

  const reporte = await reportesRepo.crear({ negocioId, usuarioId, ip, motivo: reason });

  return toApiReport(reporte);
}

module.exports = { crear, toApiReport };

const reportesRepo = require('../repositories/reportesNegocio.repository');
const { obtenerCrudoOFallar } = require('./negocios.service');
const { TooManyRequestsError } = require('../errors');
const {
  OUTDATED_REPORT_RATE_LIMIT_MAX,
  OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');

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

  return {
    id: reporte.id,
    businessId: reporte.negocio_id,
    reason: reporte.motivo,
    createdAt: reporte.fecha_creacion,
  };
}

module.exports = { crear };

const reportesRepo = require('../repositories/reportesNegocio.repository');
const { obtenerCrudoOFallar } = require('./negocios.service');

async function crear({ negocioId, usuarioId, reason }) {
  await obtenerCrudoOFallar(negocioId);

  const reporte = await reportesRepo.crear({ negocioId, usuarioId, motivo: reason });

  return {
    id: reporte.id,
    businessId: reporte.negocio_id,
    reason: reporte.motivo,
    createdAt: reporte.fecha_creacion,
  };
}

module.exports = { crear };

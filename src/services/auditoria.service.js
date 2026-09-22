const auditoriaAdminRepo = require('../repositories/auditoriaAdmin.repository');

/**
 * Único punto de entrada para dejar constancia de una acción de
 * administrador (Fase 1 del panel — sin RF asociado, ver CLAUDE.md).
 * Las fases 2-5 (colas de decisión, moderación, catálogos...) llaman
 * esto desde sus propios servicios apenas mutan algo — ej.:
 *
 *   await auditoriaService.registrar({
 *     administradorId: req.admin.id,
 *     accion: 'aprobar_negocio',
 *     entidadTipo: 'negocio',
 *     entidadId: negocio.id,
 *   });
 *
 * `accion`/`entidadTipo` son texto libre a propósito (ver la migración
 * panel-admin-base) — este archivo no valida contra una lista cerrada
 * de acciones conocidas, porque esa lista todavía no existe (se define
 * fase a fase, no de una).
 */
async function registrar({ administradorId, accion, entidadTipo, entidadId, detalle }) {
  return auditoriaAdminRepo.registrar({ administradorId, accion, entidadTipo, entidadId, detalle });
}

module.exports = { registrar };

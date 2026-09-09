const negociosRepo = require('../repositories/negocios.repository');
const resenasRepo = require('../repositories/resenas.repository');
const fotosRepo = require('../repositories/fotos.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const reportesNegocioRepo = require('../repositories/reportesNegocio.repository');
const eventosRepo = require('../repositories/eventos.repository');
const negociosService = require('./negocios.service');
const resenasService = require('./resenas.service');
const fotosService = require('./fotos.service');
const reporteNegocioService = require('./reporteNegocio.service');
const { TIPO_EVENTO_API_TO_DB } = require('./eventos.service');
const cursorUtil = require('../utils/cursor');
const { toApiBusiness, toApiReview, toApiPhoto, STATUS_DB_TO_API } = require('./business.mapper');
const { toApiUser } = require('./user.mapper');
const { NotFoundError, ConflictError } = require('../errors');
const { ADMIN_EXPORT_LIST_LIMIT } = require('../config/constants');

// Épica 9: aprobar/rechazar negocios, moderar reseñas/fotos y "marcar
// atendido" un reporte de negocio desactualizado son todas la misma forma
// de operación (fetch -> validar que el recurso siga en el estado que la
// acción espera -> mutar) — mismo patrón fetch->validar->mutar que ya usa
// el resto del proyecto (ej. negocios.service.js#actualizar con
// verificarPropietario antes de escribir).
const TIPO_EVENTO_DB_TO_API = Object.fromEntries(
  Object.entries(TIPO_EVENTO_API_TO_DB).map(([api, db]) => [db, api]),
);

const DECISION_A_ESTADO_MODERACION = {
  approved: 'aprobada',
  rejected: 'rechazada',
};

/**
 * Empaqueta una página keyset con el mismo shape que Pagination en
 * openapi.yaml — reusado por las 4 colas de moderación de esta épica
 * (negocios pendientes, reseñas/fotos reportadas, reportes de negocio
 * desactualizado), todas paginadas con el mismo criterio
 * (fecha_creacion_cursor + id, ver negocios.repository.js#listar).
 */
function armarPagina(filas, limit, mapper) {
  const hasMore = filas.length > limit;
  const pagina = hasMore ? filas.slice(0, limit) : filas;
  const ultima = pagina[pagina.length - 1];

  return {
    data: pagina.map(mapper),
    pagination: {
      nextCursor:
        hasMore && ultima
          ? cursorUtil.codificar({ fechaCreacion: ultima.fecha_creacion_cursor, id: ultima.id })
          : null,
      hasMore,
    },
  };
}

/**
 * Reetiqueta las llaves de un conteo agregado (en español, tal como
 * vienen de la base de datos) al vocabulario en inglés del contrato —
 * mismo principio que business.mapper.js, aplicado a un objeto de conteos
 * en vez de a una fila.
 */
function remapConteos(conteosPorClaveDb, dbToApi) {
  return Object.fromEntries(
    Object.entries(conteosPorClaveDb).map(([claveDb, total]) => [
      dbToApi[claveDb] ?? claveDb,
      total,
    ]),
  );
}

async function listarNegociosPendientes({ cursor, limit }) {
  const cursorDecodificado = cursorUtil.decodificarCursorFechaId(cursor);
  const filas = await negociosRepo.listarPendientes({ cursor: cursorDecodificado, limit });
  return armarPagina(filas, limit, toApiBusiness);
}

async function aprobarNegocio(id) {
  const negocio = await negociosService.obtenerCrudoOFallar(id);
  if (negocio.estado !== 'pendiente') {
    throw new ConflictError('El negocio no está pendiente de aprobación');
  }
  const actualizado = await negociosRepo.aprobar(id);
  return toApiBusiness(actualizado);
}

async function rechazarNegocio(id, reason) {
  const negocio = await negociosService.obtenerCrudoOFallar(id);
  if (negocio.estado !== 'pendiente') {
    throw new ConflictError('El negocio no está pendiente de aprobación');
  }
  const actualizado = await negociosRepo.rechazar(id, reason ?? null);
  return toApiBusiness(actualizado);
}

async function listarResenasReportadas({ cursor, limit }) {
  const cursorDecodificado = cursorUtil.decodificarCursorFechaId(cursor);
  const filas = await resenasRepo.listarPendientes({ cursor: cursorDecodificado, limit });
  return armarPagina(filas, limit, toApiReview);
}

async function moderarResena(id, decision) {
  const resena = await resenasService.obtenerCrudoOFallar(id);
  if (resena.estado_moderacion !== 'pendiente') {
    throw new ConflictError('La reseña no está pendiente de moderación');
  }
  const actualizada = await resenasRepo.moderar(id, DECISION_A_ESTADO_MODERACION[decision]);
  return toApiReview(actualizada);
}

async function listarFotosReportadas({ cursor, limit }) {
  const cursorDecodificado = cursorUtil.decodificarCursorFechaId(cursor);
  const filas = await fotosRepo.listarPendientes({ cursor: cursorDecodificado, limit });
  return armarPagina(filas, limit, toApiPhoto);
}

async function moderarFoto(id, decision) {
  const foto = await fotosService.obtenerCrudoOFallar(id);
  if (foto.estado_moderacion !== 'pendiente') {
    throw new ConflictError('La foto no está pendiente de moderación');
  }
  const actualizada = await fotosRepo.moderar(id, DECISION_A_ESTADO_MODERACION[decision]);
  return toApiPhoto(actualizada);
}

/**
 * RF faltante en la especificación original (ver CLAUDE.md, Épica 9):
 * usuarios.activo ya bloqueaba login()/refresh() desde la Épica 1, así
 * que "suspender" es apagar ese flag — nada más que agregar a la base de
 * datos.
 */
async function suspenderUsuario(id) {
  const usuario = await usuariosRepo.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuario no encontrado');
  }
  if (!usuario.activo) {
    throw new ConflictError('El usuario ya está suspendido');
  }
  const actualizado = await usuariosRepo.suspender(id);
  return toApiUser(actualizado);
}

async function listarReportesDesactualizados({ cursor, limit }) {
  const cursorDecodificado = cursorUtil.decodificarCursorFechaId(cursor);
  const filas = await reportesNegocioRepo.listarPendientes({ cursor: cursorDecodificado, limit });
  return armarPagina(filas, limit, reporteNegocioService.toApiReport);
}

async function marcarReporteAtendido(id) {
  const reporte = await reportesNegocioRepo.buscarPorId(id);
  if (!reporte) {
    throw new NotFoundError('Reporte no encontrado');
  }
  if (reporte.atendido_en) {
    throw new ConflictError('El reporte ya fue atendido');
  }
  const actualizado = await reportesNegocioRepo.marcarAtendido(id);
  return reporteNegocioService.toApiReport(actualizado);
}

/**
 * GET /admin/metrics (RF-021): "negocios activos, usuarios registrados,
 * búsquedas y contactos generados" — búsquedas/contactos se leen de
 * eventos (RF-023), ya poblada desde la Épica 5, en vez de mantener un
 * contador propio (tal como pide CLAUDE.md).
 */
async function obtenerMetricas() {
  const [negociosPorEstado, totalUsuarios, eventosPorTipo] = await Promise.all([
    negociosRepo.contarPorEstado(),
    usuariosRepo.contarTotal(),
    eventosRepo.contarPorTipo(),
  ]);

  return {
    activeBusinesses: negociosPorEstado.activo ?? 0,
    pendingBusinesses: negociosPorEstado.pendiente ?? 0,
    registeredUsers: totalUsuarios,
    searches: eventosPorTipo.busqueda ?? 0,
    contactClicks: eventosPorTipo.clic_contacto ?? 0,
  };
}

/**
 * GET /admin/reports/export (RF-022, endpoint faltante en la
 * especificación original — ver CLAUDE.md). "Formato estructurado" se
 * satisface con JSON (no se pidió CSV); superset de obtenerMetricas() más
 * el detalle de las 3 colas de moderación, cada una capada a
 * ADMIN_EXPORT_LIST_LIMIT — esto es un volcado puntual, no un endpoint
 * paginado.
 */
async function exportarReportes() {
  const [
    metrics,
    negociosPorEstado,
    eventosPorTipo,
    reportesPendientes,
    resenasPendientes,
    fotosPendientes,
  ] = await Promise.all([
    obtenerMetricas(),
    negociosRepo.contarPorEstado(),
    eventosRepo.contarPorTipo(),
    reportesNegocioRepo.listarPendientes({ cursor: null, limit: ADMIN_EXPORT_LIST_LIMIT }),
    resenasRepo.listarPendientes({ cursor: null, limit: ADMIN_EXPORT_LIST_LIMIT }),
    fotosRepo.listarPendientes({ cursor: null, limit: ADMIN_EXPORT_LIST_LIMIT }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    businessesByStatus: remapConteos(negociosPorEstado, STATUS_DB_TO_API),
    eventsByType: remapConteos(eventosPorTipo, TIPO_EVENTO_DB_TO_API),
    pendingOutdatedReports: reportesPendientes
      .slice(0, ADMIN_EXPORT_LIST_LIMIT)
      .map(reporteNegocioService.toApiReport),
    pendingReportedReviews: resenasPendientes.slice(0, ADMIN_EXPORT_LIST_LIMIT).map(toApiReview),
    pendingReportedPhotos: fotosPendientes.slice(0, ADMIN_EXPORT_LIST_LIMIT).map(toApiPhoto),
  };
}

module.exports = {
  listarNegociosPendientes,
  aprobarNegocio,
  rechazarNegocio,
  listarResenasReportadas,
  moderarResena,
  listarFotosReportadas,
  moderarFoto,
  suspenderUsuario,
  listarReportesDesactualizados,
  marcarReporteAtendido,
  obtenerMetricas,
  exportarReportes,
};

const adminService = require('../services/admin.service');
const registroAsistidoService = require('../services/registroAsistido.service');
const tiposOfertaService = require('../services/tiposOferta.service');

async function listPendingBusinesses(req, res) {
  const result = await adminService.listarNegociosPendientes(req.validatedQuery);
  res.status(200).json(result);
}

async function approveBusiness(req, res) {
  const business = await adminService.aprobarNegocio(req.params.businessId);
  res.status(200).json(business);
}

async function rejectBusiness(req, res) {
  const business = await adminService.rechazarNegocio(req.params.businessId, req.body.reason);
  res.status(200).json(business);
}

async function listReportedReviews(req, res) {
  const result = await adminService.listarResenasReportadas(req.validatedQuery);
  res.status(200).json(result);
}

async function moderateReview(req, res) {
  const review = await adminService.moderarResena(req.params.reviewId, req.body.decision);
  res.status(200).json(review);
}

async function listReportedPhotos(req, res) {
  const result = await adminService.listarFotosReportadas(req.validatedQuery);
  res.status(200).json(result);
}

async function moderatePhoto(req, res) {
  const photo = await adminService.moderarFoto(req.params.photoId, req.body.decision);
  res.status(200).json(photo);
}

async function suspendUser(req, res) {
  const user = await adminService.suspenderUsuario(req.params.userId);
  res.status(200).json(user);
}

async function reissueClaimToken(req, res) {
  const result = await registroAsistidoService.reemitirTokenReclamo(req.params.userId);
  res.status(200).json(result);
}

async function listOutdatedReports(req, res) {
  const result = await adminService.listarReportesDesactualizados(req.validatedQuery);
  res.status(200).json(result);
}

async function resolveOutdatedReport(req, res) {
  const report = await adminService.marcarReporteAtendido(req.params.reportId);
  res.status(200).json(report);
}

async function listAccountDeletionRequests(req, res) {
  const result = await adminService.listarSolicitudesEliminacionCuenta(req.validatedQuery);
  res.status(200).json(result);
}

async function resolveAccountDeletionRequest(req, res) {
  const request = await adminService.marcarSolicitudEliminacionAtendida(req.params.requestId);
  res.status(200).json(request);
}

// Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
// ver CLAUDE.md, migración tipos-oferta. Admin CRUD sobre el catálogo:
// list (incluye inactivos), create, update (active:false hace las veces
// de "eliminar" — ver tiposOferta.service.js).
async function listOfferTypes(req, res) {
  const tipos = await tiposOfertaService.listarTodos();
  res.status(200).json(tipos);
}

async function createOfferType(req, res) {
  const tipo = await tiposOfertaService.crear(req.body);
  res.status(201).json(tipo);
}

async function updateOfferType(req, res) {
  const tipo = await tiposOfertaService.actualizar(req.params.offerTypeId, req.body);
  res.status(200).json(tipo);
}

async function metrics(req, res) {
  const result = await adminService.obtenerMetricas();
  res.status(200).json(result);
}

async function exportReports(req, res) {
  const result = await adminService.exportarReportes();
  res.status(200).json(result);
}

module.exports = {
  listPendingBusinesses,
  approveBusiness,
  rejectBusiness,
  listReportedReviews,
  moderateReview,
  listReportedPhotos,
  moderatePhoto,
  suspendUser,
  reissueClaimToken,
  listOutdatedReports,
  resolveOutdatedReport,
  listAccountDeletionRequests,
  resolveAccountDeletionRequest,
  listOfferTypes,
  createOfferType,
  updateOfferType,
  metrics,
  exportReports,
};

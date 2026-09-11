const negociosService = require('../services/negocios.service');
const ubicacionService = require('../services/ubicacion.service');
const horarioService = require('../services/horario.service');
const reporteNegocioService = require('../services/reporteNegocio.service');
const productosService = require('../services/productos.service');
const fotosService = require('../services/fotos.service');
const perfilNegocioService = require('../services/perfilNegocio.service');
const resenasService = require('../services/resenas.service');
const favoritosService = require('../services/favoritos.service');
const solicitudesDisponibilidadService = require('../services/solicitudesDisponibilidad.service');
const verificacionTelefonoService = require('../services/verificacionTelefono.service');

async function create(req, res) {
  const business = await negociosService.crear(req.user.id, req.body);
  res.status(201).json(business);
}

async function list(req, res) {
  const resultado = await negociosService.listar(req.validatedQuery);
  res.status(200).json(resultado);
}

async function nearby(req, res) {
  const resultado = await negociosService.cercanos(req.validatedQuery);
  res.status(200).json(resultado);
}

async function getOne(req, res) {
  const profile = await perfilNegocioService.obtener(req.params.businessId, req.user?.id ?? null);
  res.status(200).json(profile);
}

async function update(req, res) {
  const business = await negociosService.actualizar(req.user.id, req.params.businessId, req.body);
  res.status(200).json(business);
}

async function remove(req, res) {
  await negociosService.cerrar(req.user.id, req.params.businessId);
  res.status(204).send();
}

async function getLocation(req, res) {
  const location = await ubicacionService.obtenerActual(req.params.businessId, req.user?.id ?? null);
  res.status(200).json(location);
}

async function putLocation(req, res) {
  const location = await ubicacionService.actualizar(req.user.id, req.params.businessId, req.body);
  res.status(200).json(location);
}

async function updateLocationVisibility(req, res) {
  const location = await ubicacionService.actualizarVisibilidad(
    req.user.id,
    req.params.businessId,
    req.body.showExactLocation,
  );
  res.status(200).json(location);
}

async function getSchedule(req, res) {
  const schedule = await horarioService.obtener(req.params.businessId);
  res.status(200).json(schedule);
}

async function putSchedule(req, res) {
  const schedule = await horarioService.reemplazar(req.user.id, req.params.businessId, req.body);
  res.status(200).json(schedule);
}

async function reportOutdated(req, res) {
  const report = await reporteNegocioService.crear({
    negocioId: req.params.businessId,
    usuarioId: req.user?.id,
    ip: req.ip,
    reason: req.body.reason,
  });
  res.status(201).json(report);
}

async function createProduct(req, res) {
  const product = await productosService.crear(req.user.id, req.params.businessId, req.body);
  res.status(201).json(product);
}

async function listProducts(req, res) {
  const products = await productosService.listar(req.params.businessId);
  res.status(200).json(products);
}

async function uploadPhoto(req, res) {
  const photo = await fotosService.subirParaNegocio(
    req.user.id,
    req.params.businessId,
    req.file,
    req.log,
  );
  res.status(201).json(photo);
}

async function createReview(req, res) {
  const review = await resenasService.crear(req.user.id, req.params.businessId, req.body);
  res.status(201).json(review);
}

async function listReviews(req, res) {
  const resultado = await resenasService.listar(req.params.businessId, req.validatedQuery);
  res.status(200).json(resultado);
}

async function markFavorite(req, res) {
  await favoritosService.marcar(req.user.id, req.params.businessId);
  res.status(204).send();
}

async function unmarkFavorite(req, res) {
  await favoritosService.desmarcar(req.user.id, req.params.businessId);
  res.status(204).send();
}

async function sendPhoneVerification(req, res) {
  await verificacionTelefonoService.enviarCodigo(req.user.id, req.params.businessId);
  res.status(202).send();
}

async function confirmPhoneVerification(req, res) {
  const business = await verificacionTelefonoService.confirmarCodigo(
    req.user.id,
    req.params.businessId,
    req.body.code,
  );
  res.status(200).json(business);
}

async function requestAvailability(req, res) {
  const result = await solicitudesDisponibilidadService.solicitar(
    req.user.id,
    req.params.businessId,
  );
  res.status(201).json(result);
}

module.exports = {
  create,
  list,
  nearby,
  getOne,
  update,
  remove,
  getLocation,
  updateLocationVisibility,
  putLocation,
  getSchedule,
  putSchedule,
  reportOutdated,
  createProduct,
  listProducts,
  uploadPhoto,
  createReview,
  listReviews,
  markFavorite,
  unmarkFavorite,
  sendPhoneVerification,
  confirmPhoneVerification,
  requestAvailability,
};

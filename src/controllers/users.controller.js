const usuariosRepo = require('../repositories/usuarios.repository');
const authService = require('../services/auth.service');
const negociosService = require('../services/negocios.service');
const favoritosService = require('../services/favoritos.service');
const consentimientosService = require('../services/consentimientos.service');
const resenasService = require('../services/resenas.service');
const tokensDispositivoService = require('../services/tokensDispositivo.service');
const solicitudEliminacionCuentaService = require('../services/solicitudEliminacionCuenta.service');
const { toApiUser } = require('../services/user.mapper');
const { UnauthorizedError } = require('../errors');

async function me(req, res) {
  // req.user.id viene del JWT verificado por el middleware authenticate,
  // nunca de un parámetro de la URL o del body (regla de seguridad #1).
  const usuario = await usuariosRepo.buscarPorId(req.user.id);
  if (!usuario || !usuario.activo) {
    throw new UnauthorizedError('Token de acceso faltante o inválido');
  }
  res.status(200).json(toApiUser(usuario));
}

async function listFavorites(req, res) {
  const resultado = await favoritosService.listar(req.user.id, req.validatedQuery);
  res.status(200).json(resultado);
}

async function listBusinesses(req, res) {
  const resultado = await negociosService.listarPorUsuario(req.user.id, req.validatedQuery);
  res.status(200).json(resultado);
}

async function changePassword(req, res) {
  const resultado = await authService.changePassword(req.user.id, req.body);
  res.status(200).json(resultado);
}

// PATCH /users/me (sin RF asociado, ver CLAUDE.md) — el merge "campo
// omitido conserva el valor existente" se resuelve acá (no en el
// repositorio, mismo criterio que negocios.service.js#actualizar).
async function updateMe(req, res) {
  const actual = await usuariosRepo.buscarPorId(req.user.id);
  if (!actual || !actual.activo) {
    throw new UnauthorizedError('Token de acceso faltante o inválido');
  }

  const nombreCompleto =
    req.body.fullName !== undefined ? req.body.fullName : actual.nombre_completo;
  const telefono = req.body.phone !== undefined ? req.body.phone : actual.telefono;

  const actualizado = await usuariosRepo.actualizar(req.user.id, { nombreCompleto, telefono });
  res.status(200).json(toApiUser(actualizado));
}

async function listConsents(req, res) {
  const consents = await consentimientosService.listar(req.user.id);
  res.status(200).json(consents);
}

async function listReviews(req, res) {
  const resultado = await resenasService.listarPorUsuario(req.user.id, req.validatedQuery);
  res.status(200).json(resultado);
}

async function registerDeviceToken(req, res) {
  await tokensDispositivoService.registrar(req.user.id, req.body.token);
  res.status(204).send();
}

async function requestAccountDeletion(req, res) {
  const resultado = await solicitudEliminacionCuentaService.solicitar(req.user.id, req.body);
  res.status(201).json(resultado);
}

module.exports = {
  me,
  listFavorites,
  listBusinesses,
  changePassword,
  updateMe,
  listConsents,
  listReviews,
  registerDeviceToken,
  requestAccountDeletion,
};

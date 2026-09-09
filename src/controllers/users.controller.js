const usuariosRepo = require('../repositories/usuarios.repository');
const favoritosService = require('../services/favoritos.service');
const consentimientosService = require('../services/consentimientos.service');
const tokensDispositivoService = require('../services/tokensDispositivo.service');
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

async function listConsents(req, res) {
  const consents = await consentimientosService.listar(req.user.id);
  res.status(200).json(consents);
}

async function registerDeviceToken(req, res) {
  await tokensDispositivoService.registrar(req.user.id, req.body.token);
  res.status(204).send();
}

module.exports = { me, listFavorites, listConsents, registerDeviceToken };

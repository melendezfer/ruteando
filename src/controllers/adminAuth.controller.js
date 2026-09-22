const adminAuthService = require('../services/adminAuth.service');
const administradoresRepo = require('../repositories/administradores.repository');
const { toApiAdministrator } = require('../services/administrador.mapper');
const { UnauthorizedError } = require('../errors');

// Express 5 reenvía cualquier rechazo de promesa al error handler central
// — mismo criterio que auth.controller.js, sin try/catch por controlador.

async function login(req, res) {
  const result = await adminAuthService.login(req.body);
  res.status(200).json(result);
}

async function refresh(req, res) {
  const result = await adminAuthService.refresh(req.body);
  res.status(200).json(result);
}

async function logout(req, res) {
  await adminAuthService.logout({ refreshToken: req.body.refreshToken, administradorId: req.admin.id });
  res.status(204).send();
}

async function me(req, res) {
  // req.admin.id viene del JWT verificado por authenticateAdmin, nunca de
  // un parámetro de la URL o del body (regla de seguridad #1).
  const administrador = await administradoresRepo.buscarPorId(req.admin.id);
  if (!administrador || !administrador.activo) {
    throw new UnauthorizedError('Token de acceso faltante o inválido');
  }
  res.status(200).json(toApiAdministrator(administrador));
}

module.exports = { login, refresh, logout, me };

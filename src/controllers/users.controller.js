const usuariosRepo = require('../repositories/usuarios.repository');
const favoritosService = require('../services/favoritos.service');
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

module.exports = { me, listFavorites };

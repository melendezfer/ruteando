const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ADMIN_JWT_ACCESS_TOKEN_TTL } = require('../config/constants');
const { ADMIN_ROLE_DB_TO_API } = require('./administrador.mapper');

/**
 * Firma del access token de administrador — mismo mecanismo que
 * token.service.js#signAccessToken (JWT verificable sin ir a la base de
 * datos), pero con ADMIN_JWT_ACCESS_SECRET, un secreto PROPIO y
 * distinto del que usan los usuarios normales (ver env.js). El refresh
 * token opaco y su hash reusan `generateOpaqueToken`/`hashToken` de
 * token.service.js tal cual — esas dos funciones no tienen nada
 * específico de "usuario", son criptografía genérica.
 */
function signAdminAccessToken(administrador) {
  return jwt.sign(
    { sub: administrador.id, role: ADMIN_ROLE_DB_TO_API[administrador.rol] },
    env.ADMIN_JWT_ACCESS_SECRET,
    { expiresIn: ADMIN_JWT_ACCESS_TOKEN_TTL },
  );
}

module.exports = { signAdminAccessToken };

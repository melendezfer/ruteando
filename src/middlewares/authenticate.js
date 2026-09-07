const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { UnauthorizedError } = require('../errors');

function verificarBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return { id: payload.sub, role: payload.role };
}

/**
 * Verifica el access token del header Authorization: Bearer <jwt>.
 * Nunca confía en un id de usuario que venga en el body/query — req.user
 * es la única fuente de verdad para "quién soy" en el resto de la app
 * (regla de seguridad #1).
 */
function authenticate(req, res, next) {
  try {
    const user = verificarBearer(req);
    if (!user) {
      return next(new UnauthorizedError('Token de acceso faltante o inválido'));
    }
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError('Token de acceso faltante o inválido'));
  }
}

/**
 * Para endpoints públicos que igual quieren identificar al usuario si
 * manda un token (ej. RF-025: "cualquier usuario" puede reportar, pero si
 * está logueado se asocia el reporte a su cuenta). Sin header -> sigue
 * como anónimo. Con header presente pero inválido/expirado -> 401 (un
 * token roto no debe degradarse en silencio a anónimo).
 */
function optionalAuthenticate(req, res, next) {
  if (!req.headers.authorization) {
    return next();
  }
  authenticate(req, res, next);
}

module.exports = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;

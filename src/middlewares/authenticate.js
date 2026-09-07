const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { UnauthorizedError } = require('../errors');

/**
 * Verifica el access token del header Authorization: Bearer <jwt>.
 * Nunca confía en un id de usuario que venga en el body/query — req.user
 * es la única fuente de verdad para "quién soy" en el resto de la app
 * (regla de seguridad #1).
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Token de acceso faltante o inválido'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Token de acceso faltante o inválido'));
  }
}

module.exports = authenticate;

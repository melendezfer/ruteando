const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { UnauthorizedError } = require('../errors');

/**
 * Verifica el access token del panel de administrador (Fase 1 — sin RF
 * asociado, ver CLAUDE.md) — mismo mecanismo que middlewares/authenticate.js
 * (Bearer JWT sin ir a la base de datos), pero contra
 * ADMIN_JWT_ACCESS_SECRET, no JWT_ACCESS_SECRET: un token de un usuario
 * normal (vendedor/consumidor/el "administrador" viejo de usuarios.rol)
 * es estructuralmente inverificable acá (falla la firma), y viceversa
 * — "login de administrador separado", pedido explícito del usuario,
 * reforzado a nivel criptográfico, no solo de convención de nombres.
 * `req.admin` (no `req.user`) es la única fuente de verdad para "qué
 * administrador soy" en el resto de este sistema — nunca se mezcla con
 * `req.user`.
 */
function verificarBearerAdmin(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  const payload = jwt.verify(token, env.ADMIN_JWT_ACCESS_SECRET);
  return { id: payload.sub, role: payload.role };
}

function authenticateAdmin(req, res, next) {
  try {
    const admin = verificarBearerAdmin(req);
    if (!admin) {
      return next(new UnauthorizedError('Token de acceso faltante o inválido'));
    }
    req.admin = admin;
    next();
  } catch {
    next(new UnauthorizedError('Token de acceso faltante o inválido'));
  }
}

module.exports = authenticateAdmin;

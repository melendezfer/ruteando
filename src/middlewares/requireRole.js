const { ForbiddenError } = require('../errors');

/**
 * Autorización a nivel de función (regla de seguridad #3): rechaza con 403
 * si req.user.role no está en la lista permitida. Debe ir siempre después
 * de authenticate — nunca confía en un rol que no venga del JWT verificado.
 */
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.user.role)) {
      return next(new ForbiddenError('No tiene permisos para esta acción'));
    }
    next();
  };
}

module.exports = requireRole;

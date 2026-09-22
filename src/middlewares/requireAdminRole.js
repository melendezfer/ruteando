const { ForbiddenError } = require('../errors');

/**
 * Punto CENTRAL de control de permisos del panel de administrador (Fase
 * 1 — sin RF asociado, ver CLAUDE.md, requisito explícito del usuario:
 * "que agregar una función nueva más adelante sea solo etiquetarla con
 * qué rol la puede usar, sin reescribir la lógica de acceso cada vez").
 * Mismo patrón exacto que middlewares/requireRole.js (usuarios) —
 * rechaza con 403 si `req.admin.role` no está en la lista permitida.
 * Debe ir siempre después de `authenticateAdmin` (necesita `req.admin`,
 * que solo existe si ese middleware ya corrió y verificó el JWT).
 *
 * Uso previsto para las fases 2-5: cada módulo nuevo del panel llama
 * `requireAdminRole('admin', 'super_admin')` (delegable) o
 * `requireAdminRole('super_admin')` (solo el dueño) al declarar sus
 * rutas — nunca una condición `if (req.admin.role === ...)` repetida a
 * mano dentro de cada controlador.
 */
function requireAdminRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.admin.role)) {
      return next(new ForbiddenError('No tiene permisos para esta acción'));
    }
    next();
  };
}

module.exports = requireAdminRole;

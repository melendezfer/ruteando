const { ValidationError } = require('../errors');

/**
 * Valida req.body contra un schema de zod. En éxito, reemplaza req.body por
 * los datos ya parseados/coercionados (nunca confiar en el body crudo del
 * cliente — regla de seguridad #1 de CLAUDE.md).
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('El cuerpo de la solicitud no es válido', { errors }));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };

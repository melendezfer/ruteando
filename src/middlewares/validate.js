const { ValidationError, NotFoundError } = require('../errors');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Un UUID mal formado nunca debe llegar a una consulta parametrizada: en
 * vez de dejar que Postgres tire "invalid input syntax for type uuid"
 * (un 500 sin sentido para el cliente), lo tratamos como 404 — un id con
 * formato inválido tampoco existe.
 */
function validateUuidParam(paramName) {
  return (req, res, next) => {
    if (!UUID_PATTERN.test(req.params[paramName])) {
      return next(new NotFoundError('Recurso no encontrado'));
    }
    next();
  };
}

module.exports = { validateBody, validateUuidParam };

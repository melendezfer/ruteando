const { ProblemDetailsError } = require('../errors');

/**
 * Middleware de error central. Toda respuesta de error de la API sigue
 * RFC 9457 (Problem Details) — regla de seguridad #10 de CLAUDE.md: nunca
 * un stack trace ni un mensaje genérico sin estructura hacia el cliente.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isKnown = err instanceof ProblemDetailsError;
  const problem = isKnown
    ? err.toProblemDetails()
    : {
        type: 'about:blank',
        title: 'Error interno del servidor',
        status: 500,
        detail: 'Ocurrió un error inesperado.',
      };

  if (!problem.instance) {
    problem.instance = req.originalUrl;
  }

  if (isKnown) {
    req.log?.warn({ err }, problem.title);
  } else {
    req.log?.error({ err }, 'Error no controlado');
  }

  res.status(problem.status).type('application/problem+json').send(problem);
}

module.exports = errorHandler;
